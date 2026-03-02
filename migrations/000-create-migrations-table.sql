-- 迁移追踪表
-- 用于记录已执行的数据库迁移，防止重复执行或遗漏

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'rolled_back'))
);

CREATE INDEX IF NOT EXISTS idx_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON schema_migrations(executed_at DESC);

COMMENT ON TABLE schema_migrations IS '数据库迁移执行记录表';
COMMENT ON COLUMN schema_migrations.version IS '迁移版本号（如 20260302_001）';
COMMENT ON COLUMN schema_migrations.name IS '迁移描述（如 add-search-vector-column）';
COMMENT ON COLUMN schema_migrations.checksum IS '迁移文件 SHA-256 校验和';
