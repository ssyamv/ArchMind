-- #69 AI 任务队列迁移
-- 统一的 AI 生成任务记录表

CREATE TABLE IF NOT EXISTS ai_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,     -- 任务类型：prd_generate | prototype_generate | logic_map_generate | document_process | workspace_export
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress      INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  title         TEXT,              -- 任务标题（如 PRD 标题）
  input         JSONB,             -- 任务输入参数（用于重试时重新提交）
  output_ref    TEXT,              -- 结果资源 ID（如 prd_id、prototype_id）
  error         TEXT,              -- 失败原因
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_user_status
  ON ai_tasks(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_workspace
  ON ai_tasks(workspace_id, created_at DESC);
