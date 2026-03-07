-- #66 逻辑图谱生成 - 数据库迁移（Mermaid 格式）
-- 创建日期：2026-03-03

CREATE TABLE IF NOT EXISTS mermaid_logic_maps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prd_id        UUID REFERENCES prd_documents(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('flowchart', 'sequence', 'state', 'class')),
  mermaid_code  TEXT NOT NULL,
  svg_cache     TEXT,
  focus         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mermaid_lm_workspace_id ON mermaid_logic_maps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mermaid_lm_prd_id ON mermaid_logic_maps(prd_id);
CREATE INDEX IF NOT EXISTS idx_mermaid_lm_user_id ON mermaid_logic_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_mermaid_lm_created_at ON mermaid_logic_maps(created_at DESC);

