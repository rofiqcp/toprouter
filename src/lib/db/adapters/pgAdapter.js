import pg from "pg";

// Known primary keys for INSERT OR REPLACE translation
const TABLE_PKS = {
  settings: ["id"],
  providerConnections: ["id"],
  providerNodes: ["id"],
  proxyPools: ["id"],
  apiKeys: ["id"],
  combos: ["id"],
  kv: ["scope", "key"],
  usageDaily: ["dateKey"],
  requestDetails: ["id"],
  _meta: ["key"],
};

// Column name mappings: PG lowercase → camelCase (SQLite compat)
const COLUMN_MAP = {
  authtype: "authType",
  isactive: "isActive",
  createdat: "createdAt",
  updatedat: "updatedAt",
  apikey: "apiKey",
  machineid: "machineId",
  accesstoken: "accessToken",
  refreshtoken: "refreshToken",
  expiresat: "expiresAt",
  tokenType: "tokenType",
  tokentype: "tokenType",
  teststatus: "testStatus",
  lasttested: "lastTested",
  lasterror: "lastError",
  lasterrorat: "lastErrorAt",
  ratelimiteduntil: "rateLimitedUntil",
  expiresin: "expiresIn",
  errorcode: "errorCode",
  consecutiveusecount: "consecutiveUseCount",
  idtoken: "idToken",
  lastrefreshat: "lastRefreshAt",
  defaultmodel: "defaultModel",
  displayname: "displayName",
  globalpriority: "globalPriority",
  prompttokens: "promptTokens",
  completiontokens: "completionTokens",
  connectionid: "connectionId",
  baseurl: "baseUrl",
  providerspecificdata: "providerSpecificData",
  datekey: "dateKey",
  authType: "authType",
};

function normalizeRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const mapped = COLUMN_MAP[k] || k;
    out[mapped] = v;
  }
  return out;
}

function normalizeRows(rows) {
  return rows.map(normalizeRow);
}

// Translate SQLite SQL to PostgreSQL-compatible SQL
// Also converts ? placeholders to $1, $2, etc. for PostgreSQL
function translateSQL(sql) {
  // Skip PRAGMA silently
  if (/^\s*PRAGMA\b/i.test(sql)) return null;

  let out = sql;

  // Convert ? placeholders to $1, $2, etc.
  let paramIndex = 0;
  out = out.replace(/\?/g, () => `$${++paramIndex}`);

  // INSERT OR REPLACE INTO table(cols) VALUES(...) → INSERT INTO table(cols) VALUES(...) ON CONFLICT (pk) DO UPDATE SET ...
  const irep = /INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)/i;
  const m = out.match(irep);
  if (m) {
    const table = m[1];
    const pks = TABLE_PKS[table];
    if (pks) {
      const cols = m[2].split(",").map((c) => c.trim());
      const setClause = cols
        .filter((c) => !pks.includes(c))
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(", ");
      const pkStr = pks.map((c) => `"${c}"`).join(", ");
      out = out.replace(irep, `INSERT INTO ${table}(${m[2]})`);
      if (setClause) {
        out = `${out} ON CONFLICT (${pkStr}) DO UPDATE SET ${setClause}`;
      } else {
        out = `${out} ON CONFLICT (${pkStr}) DO NOTHING`;
      }
    }
  }

  // ON CONFLICT(key) without parens → ON CONFLICT (key)
  // PG requires parentheses around conflict target
  out = out.replace(/ON CONFLICT\s*\(([^)]+)\)/, "ON CONFLICT ($1)");
  // If no parens yet, add them for single column
  out = out.replace(/ON CONFLICT\s+(\w+)\s+DO/, (_, col) => {
    if (col === "(") return _; // already has parens
    return `ON CONFLICT ("${col}") DO`;
  });

  // INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
  out = out.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, "SERIAL PRIMARY KEY");

  // CHECK (id = 1) on settings → PG supports this, keep as-is

  return out;
}

function createTxAdapter(client) {
  return {
    run(sql, params = []) {
      const t = translateSQL(sql);
      if (t === null) return Promise.resolve({ changes: 0, lastInsertRowid: null });
      return client.query(t, params).then((r) => ({
        changes: r.rowCount ?? 0,
        lastInsertRowid: null,
      }));
    },
    get(sql, params = []) {
      const t = translateSQL(sql);
      if (t === null) return Promise.resolve(undefined);
      return client.query(t, params).then((r) =>
        r.rows.length > 0 ? normalizeRow(r.rows[0]) : undefined,
      );
    },
    all(sql, params = []) {
      // PRAGMA table_info → PG information_schema
      const pm = sql.match(/PRAGMA\s+table_info\((\w+)\)/i);
      if (pm) {
        const table = pm[1];
        return client.query(
          `SELECT column_name AS name, data_type AS type, is_nullable = 'YES' AS "notnull", column_default AS dflt_value, ordinal_position AS cid FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
          [table]
        ).then((r) => r.rows);
      }
      const t = translateSQL(sql);
      if (t === null) return Promise.resolve([]);
      return client.query(t, params).then((r) => normalizeRows(r.rows));
    },
    exec(sql) {
      const t = translateSQL(sql);
      if (t === null) return Promise.resolve();
      return client.query(t);
    },
    raw: client,
  };
}

export function createPgAdapter() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.PG_MAX_CONNECTIONS || "10", 10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || "10000", 10),
    connectionTimeoutMillis: parseInt(
      process.env.PG_CONNECTION_TIMEOUT_MS || "5000",
      10,
    ),
  });

  let _txClient = null; // active transaction client

  pool.on("error", (err) => {
    console.error("[pgAdapter] Unexpected pool error:", err.message);
  });

  // Execute SQL, routing through transaction client if one is active
  async function _query(sql, params = []) {
    if (_txClient) return _txClient.query(sql, params);
    return pool.query(sql, params);
  }

  async function run(sql, params = []) {
    const t = translateSQL(sql);
    if (t === null) return { changes: 0, lastInsertRowid: null };
    const r = await _query(t, params);
    return { changes: r.rowCount ?? 0, lastInsertRowid: null };
  }

  async function get(sql, params = []) {
    const t = translateSQL(sql);
    if (t === null) return undefined;
    const r = await _query(t, params);
    return r.rows.length > 0 ? normalizeRow(r.rows[0]) : undefined;
  }

  async function all(sql, params = []) {
    // PRAGMA table_info → PG information_schema
    const pm = sql.match(/PRAGMA\s+table_info\((\w+)\)/i);
    if (pm) {
      const table = pm[1];
      const r = await _query(
        `SELECT column_name AS name, data_type AS type, is_nullable = 'YES' AS "notnull", column_default AS dflt_value, ordinal_position AS cid FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      return r.rows;
    }
    const t = translateSQL(sql);
    if (t === null) return [];
    const r = await _query(t, params);
    return normalizeRows(r.rows);
  }

  async function exec(sql) {
    const t = translateSQL(sql);
    if (t === null) return;
    await _query(t);
  }

  async function transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      _txClient = client;
      const result = await fn(createTxAdapter(client));
      await client.query("COMMIT");
      _txClient = null;
      client.release();
      return result;
    } catch (e) {
      _txClient = null;
      await client.query("ROLLBACK").catch(() => {});
      client.release();
      throw e;
    }
  }

  async function close() {
    _txClient = null;
    await pool.end();
  }

  return {
    driver: "pg",
    run,
    get,
    all,
    exec,
    transaction,
    close,
    raw: pool,
  };
}
