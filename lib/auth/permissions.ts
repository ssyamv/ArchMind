/**
 * RBAC 权限矩阵定义
 *
 * 角色等级（数值越大权限越高）:
 *   guest(0) < viewer(1) < editor(2) < admin(3) < owner(4)
 *
 * 向后兼容：原 member 角色等价于 editor
 */

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'guest' | 'member'
export type ResourceType = 'workspace' | 'document' | 'prd' | 'prototype' | 'logic_map' | 'webhook' | 'member'
export type Action = 'read' | 'write' | 'delete' | 'manage'

/** 角色等级映射（member 等价于 editor） */
export const ROLE_LEVELS: Record<WorkspaceRole, number> = {
  guest: 0,
  viewer: 1,
  editor: 2,
  member: 2, // 向后兼容别名
  admin: 3,
  owner: 4,
}

/**
 * 权限矩阵：`resource:action` → 最低需要的角色等级
 *
 * 设计原则：
 * - viewer 及以上：可读所有内容
 * - editor 及以上：可创建/编辑内容
 * - admin 及以上：可删除内容、管理设置
 * - owner：独有删除工作区权限
 */
export const PERMISSION_MATRIX: Record<string, number> = {
  // 工作区
  'workspace:read': ROLE_LEVELS.viewer,
  'workspace:write': ROLE_LEVELS.admin,
  'workspace:delete': ROLE_LEVELS.owner,
  'workspace:manage': ROLE_LEVELS.admin,

  // 文档
  'document:read': ROLE_LEVELS.viewer,
  'document:write': ROLE_LEVELS.editor,
  'document:delete': ROLE_LEVELS.editor,

  // PRD
  'prd:read': ROLE_LEVELS.viewer,
  'prd:write': ROLE_LEVELS.editor,
  'prd:delete': ROLE_LEVELS.admin,

  // 原型
  'prototype:read': ROLE_LEVELS.viewer,
  'prototype:write': ROLE_LEVELS.editor,
  'prototype:delete': ROLE_LEVELS.admin,

  // 逻辑图
  'logic_map:read': ROLE_LEVELS.viewer,
  'logic_map:write': ROLE_LEVELS.editor,
  'logic_map:delete': ROLE_LEVELS.editor,

  // Webhook
  'webhook:manage': ROLE_LEVELS.admin,

  // 成员管理
  'member:read': ROLE_LEVELS.viewer,
  'member:manage': ROLE_LEVELS.admin,
}

/**
 * 检查角色是否有指定权限
 */
export function hasPermission (role: WorkspaceRole, resource: ResourceType, action: Action): boolean {
  const key = `${resource}:${action}`
  const required = PERMISSION_MATRIX[key]
  if (required === undefined) return false
  return ROLE_LEVELS[role] >= required
}

/**
 * 获取角色的所有权限列表
 */
export function getRolePermissions (role: WorkspaceRole): string[] {
  const level = ROLE_LEVELS[role]
  return Object.entries(PERMISSION_MATRIX)
    .filter(([, required]) => level >= required)
    .map(([key]) => key)
}

/**
 * 角色描述（供前端展示使用）
 */
export const ROLE_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  owner: {
    name: '所有者',
    description: '工作区创建者，拥有所有权限，包括删除工作区',
  },
  admin: {
    name: '管理员',
    description: '完整管理权限：成员管理、全部资源读写删除',
  },
  editor: {
    name: '编辑者',
    description: '可上传文档、创建 PRD、生成原型，不可删除 PRD 和原型',
  },
  member: {
    name: '成员',
    description: '等同于编辑者（向后兼容）',
  },
  viewer: {
    name: '只读者',
    description: '可查看所有内容，不可创建或编辑',
  },
  guest: {
    name: '访客',
    description: '仅可查看被明确分享的内容',
  },
}
