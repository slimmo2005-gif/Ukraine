-- Run if schema.sql was applied before excluded_sessions existed:
--   npx wrangler d1 execute ukraine-visits --remote --file=exclude-sessions-migration.sql

CREATE TABLE IF NOT EXISTS excluded_sessions (
  session_id TEXT PRIMARY KEY NOT NULL,
  excluded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
