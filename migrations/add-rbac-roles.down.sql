-- 回滚：RBAC 精细权限系统
-- 移除 workspace_permission_overrides 表，恢复旧角色约束

DROP INDEX IF EXISTS idx_permission_overrides_resource;
DROP INDEX IF EXISTS idx_permission_overrides_workspace_user;
DROP TABLE IF EXISTS workspace_permission_overrides;

-- 还原 workspace_members.role 约束为旧版（owner/admin/member）
ALTER TABLE workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

-- 将扩展角色降级为 member
UPDATE workspace_members
  SET role = 'member'
  WHERE role IN ('editor', 'viewer', 'guest');
