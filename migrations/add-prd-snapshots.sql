-- PRD Git 风格版本管理：快照表
-- snapshot_type: 'auto' = 每次保存自动创建, 'manual' = 用户显式创建命名版本

CREATE TABLE IF NOT EXISTS prd_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id        UUID NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(10) NOT NULL DEFAULT 'auto'
                  CHECK (snapshot_type IN ('auto', 'manual')),
  tag           VARCHAR(200),          -- 手动版本的标签名，auto 快照为 NULL
  description   TEXT,                  -- 备注（可选）
  content       TEXT NOT NULL,         -- PRD 内容全量快照
  content_size  INTEGER,               -- 内容字符数，便于前端展示无需解析内容
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 按 prd_id + 时间查快照列表（最常用查询）
CREATE INDEX IF NOT EXISTS idx_prd_snapshots_prd_created
  ON prd_snapshots(prd_id, created_at DESC);

-- 快速过滤手动/自动版本
CREATE INDEX IF NOT EXISTS idx_prd_snapshots_type
  ON prd_snapshots(prd_id, snapshot_type);
