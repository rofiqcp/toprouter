// Migration 003 — add oauthClients table for TopRouter-as-Device-Authorization-Server.
export default {
  version: 3,
  name: "oauth-clients",
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS oauthClients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        label TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        lastUsedAt TEXT
      )
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_oc_active ON oauthClients(isActive)`);
    console.log("[migration 003] oauthClients created");
  },
};
