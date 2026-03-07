-- #62 RBAC 精细权限系统迁移
-- 创建日期：2026-03-03

BEGIN;

-- 1. 扩展 workspace_members.role 的 CHECK 约束（新增 editor/viewer/guest 角色）
-- 注意：PostgreSQL 使用 VARCHAR + CHECK，不使用 ENUM，直接修改约束即可

ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'guest', 'member'));

-- 2. 扩展 workspace_invitations.role 的 CHECK 约束
ALTER TABLE workspace_invitations
  DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;

ALTER TABLE workspace_invitations
  ADD CONSTRAINT workspace_invitations_role_check
  CHECK (role IN ('admin', 'editor', 'viewer', 'guest', 'member'));

-- 3. 将现有 member 角色迁移为 editor（向后兼容）
UPDATE workspace_members SET role = 'editor' WHERE role = 'member';

-- 4. 新增资源级权限覆盖表（可选，用于特殊权限需求）
CREATE TABLE IF NOT EXISTS workspace_permission_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,  -- 'document' | 'prd' | 'prototype' | 'logic_map'
  resource_id   TEXT NOT NULL,
  action        TEXT NOT NULL,  -- 'read' | 'write' | 'delete'
  granted       BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id, resource_type, resource_id, action)
);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_workspace_user
  ON workspace_permission_overrides(workspace_id, user_id);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_resource
  ON workspace_permission_overrides(resource_type, resource_id);

COMMIT;
