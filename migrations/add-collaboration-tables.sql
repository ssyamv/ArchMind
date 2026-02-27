-- 团队协作：评论表与活动日志增强
-- v0.3.0 - #47 Team Collaboration
-- 执行方式: psql $DATABASE_URL -f migrations/add-collaboration-tables.sql

-- ============================================================
-- 1. 评论表
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_type   VARCHAR(20) NOT NULL CHECK (target_type IN ('document', 'prd', 'prototype')),
  target_id     UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  -- @提及的用户 ID 数组，格式: ["uuid1", "uuid2"]
  mentions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolved      BOOLEAN NOT NULL DEFAULT false,
  resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_workspace      ON comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comments_target         ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_user           ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_resolved       ON comments(resolved);
CREATE INDEX IF NOT EXISTS idx_comments_created_at     ON comments(created_at DESC);

-- ============================================================
-- 2. 活动日志表（工作区可见的操作时间线）
-- 注意：audit_logs 是安全审计，activity_logs 是面向用户的动态流
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 操作动词，如 uploaded_document / generated_prd / added_comment
  action         VARCHAR(50) NOT NULL,
  resource_type  VARCHAR(20),
  resource_id    UUID,
  resource_name  VARCHAR(500),
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace    ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user         ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at   ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action       ON activity_logs(action);
