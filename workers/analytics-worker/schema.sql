-- Run once after creating the D1 database:
--   npx wrangler d1 execute ukraine-visits --remote --file=schema.sql
-- (use your database name from wrangler.toml)

CREATE TABLE IF NOT EXISTS visits (
  session_id TEXT PRIMARY KEY NOT NULL,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visits_country ON visits (country);
CREATE INDEX IF NOT EXISTS idx_visits_created ON visits (created_at);
