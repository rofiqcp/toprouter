export default {
  version: 2,
  name: "usage-timestamp-to-timestamptz",
  async up(db) {
    // PostgreSQL: ALTER column type from TEXT to TIMESTAMPTZ
    // SQLite: column is TEXT (ISO8601 string), no change needed
    
    const driverName = db?.constructor?.name;
    const isPg = db?.driver === "pg" || driverName === "PostgresAdapter" || driverName === "PgAdapter";
    
    if (isPg) {
      // PostgreSQL: convert timestamp column to TIMESTAMPTZ
      await db.exec(`
        ALTER TABLE "usageHistory" 
        ALTER COLUMN "timestamp" TYPE TIMESTAMPTZ 
        USING "timestamp"::TIMESTAMPTZ
      `);
      
      console.log("[migration 002] usageHistory.timestamp → TIMESTAMPTZ");
    }
    // SQLite: no-op, TEXT is fine for ISO8601 strings
  },
};
