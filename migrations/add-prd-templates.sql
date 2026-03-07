-- #67 PRD 模板系统数据库迁移

CREATE TABLE IF NOT EXISTS prd_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  type          VARCHAR(50) NOT NULL,
  sections      JSONB NOT NULL,
  system_prompt TEXT,
  is_builtin    BOOLEAN DEFAULT false,
  is_public     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prd_templates_workspace
  ON prd_templates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_prd_templates_builtin
  ON prd_templates(is_builtin) WHERE is_builtin = true;
