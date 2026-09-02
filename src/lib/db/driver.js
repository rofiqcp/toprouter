import { ensureDirs, DATA_FILE } from "./paths.js";

if (!global._dbAdapter) global._dbAdapter = { instance: null, initPromise: null, logged: false };
const state = global._dbAdapter;

function safePgLocation(raw) {
  try {
    const u = new URL(raw);
    const port = u.port ? `:${u.port}` : "";
    return `${u.protocol}//${u.hostname}${port}${u.pathname || ""}`;
  } catch {
    return "[configured]";
  }
}

function wrapAsync(adapter) {
  if (adapter.driver === "pg") return adapter;

  let txQueue = Promise.resolve();
  const wrapped = {
    ...adapter,
    run: (sql, params) => Promise.resolve(adapter.run(sql, params)),
    get: (sql, params) => Promise.resolve(adapter.get(sql, params)),
    all: (sql, params) => Promise.resolve(adapter.all(sql, params)),
    exec: (sql) => Promise.resolve(adapter.exec(sql)),
  };

  // TopRouter repositories use async transaction callbacks so the same code can
  // run on PostgreSQL. Native SQLite transaction helpers are synchronous and
  // reject Promise-returning callbacks. Serialize async transactions and hold a
  // SAVEPOINT until the callback settles to preserve rollback semantics.
  wrapped.transaction = (fn) => {
    const execute = async () => {
      const sp = `toprouter_async_${Math.random().toString(36).slice(2)}`;
      adapter.exec(`SAVEPOINT ${sp}`);
      try {
        const result = await fn(wrapped);
        adapter.exec(`RELEASE ${sp}`);
        return result;
      } catch (error) {
        try {
          adapter.exec(`ROLLBACK TO ${sp}`);
          adapter.exec(`RELEASE ${sp}`);
        } catch {}
        throw error;
      }
    };
    const pending = txQueue.then(execute, execute);
    txQueue = pending.catch(() => {});
    return pending;
  };

  return wrapped;
}

async function tryBunSqlite() {
  if (!process.versions.bun) return null;
  try {
    const { createBunSqliteAdapter } = await import("./adapters/bunSqliteAdapter.js");
    return wrapAsync(await createBunSqliteAdapter(DATA_FILE));
  } catch (e) {
    console.warn(`[DB] bun:sqlite unavailable: ${e.message}`);
    return null;
  }
}

async function tryBetterSqlite() {
  if (process.versions.bun) return null;
  try {
    const { createBetterSqliteAdapter } = await import("./adapters/betterSqliteAdapter.js");
    return wrapAsync(createBetterSqliteAdapter(DATA_FILE));
  } catch (e) {
    console.warn(`[DB] better-sqlite3 unavailable: ${e.message}`);
    return null;
  }
}

async function tryNodeSqlite() {
  if (process.versions.bun) return null;
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj < 22 || (maj === 22 && min < 5)) return null;
  try {
    const { createNodeSqliteAdapter } = await import("./adapters/nodeSqliteAdapter.js");
    return wrapAsync(await createNodeSqliteAdapter(DATA_FILE));
  } catch (e) {
    console.warn(`[DB] node:sqlite unavailable: ${e.message}`);
    return null;
  }
}

async function trySqlJs() {
  try {
    const { createSqlJsAdapter } = await import("./adapters/sqljsAdapter.js");
    return wrapAsync(await createSqlJsAdapter(DATA_FILE));
  } catch (e) {
    console.warn(`[DB] sql.js unavailable: ${e.message}`);
    return null;
  }
}

async function tryPostgres() {
  if (!process.env.DATABASE_URL || process.env.POSTGRES_ENABLED !== "true") return null;
  try {
    const { createPgAdapter } = await import("./adapters/pgAdapter.js");
    return wrapAsync(await createPgAdapter());
  } catch (e) {
    console.warn(`[DB] postgres unavailable: ${e.message}`);
    return null;
  }
}

async function initAdapter() {
  ensureDirs();
  let adapter = await tryPostgres();
  if (!adapter) adapter = await tryBunSqlite();
  if (!adapter) adapter = await tryBetterSqlite();
  if (!adapter) adapter = await tryNodeSqlite();
  if (!adapter) adapter = await trySqlJs();
  if (!adapter) throw new Error("[DB] No database driver available (postgres/bun/better/node/sql.js all failed)");

  if (!state.logged) {
    const loc = adapter.driver === "pg" ? safePgLocation(process.env.DATABASE_URL) : DATA_FILE;
    console.log(`[DB] Driver: ${adapter.driver} | ${adapter.driver === "pg" ? "url" : "file"}: ${loc}`);
    state.logged = true;
  }

  const { runMigrationOnce } = await import("./migrate.js");
  await runMigrationOnce(adapter);
  return adapter;
}

export async function getAdapter() {
  if (state.instance) return state.instance;
  if (!state.initPromise) state.initPromise = initAdapter().then((a) => { state.instance = a; return a; });
  return state.initPromise;
}

export function getAdapterSync() {
  if (!state.instance) throw new Error("[DB] adapter not initialized — await getAdapter() first");
  return state.instance;
}
