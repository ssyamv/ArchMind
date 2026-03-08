-- v0.6.0 迁移历史表
-- 记录所有 up/down 迁移的执行历史，支持回滚追踪

CREATE TABLE IF NOT EXISTS migration_history (
  id          SERIAL PRIMARY KEY,
  version     TEXT NOT NULL,
  filename    TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_history_filename
  ON migration_history(filename);

CREATE INDEX IF NOT EXISTS idx_migration_history_executed_at
  ON migration_history(executed_at DESC);
