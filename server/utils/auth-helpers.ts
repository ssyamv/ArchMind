/**
 * 认证工具函数
 *
 * 提供 API 端点中常用的认证和权限校验方法。
 * 放在 server/utils/ 下由 Nuxt 自动导入。
 */

import { dbClient } from '~/lib/db/client'
import { type WorkspaceRole, type ResourceType, type Action, hasPermission } from '~/lib/auth/permissions'

/**
 * 从 event.context 获取已认证的 userId
 * 如果未认证则抛出 401 错误
 */
export function requireAuth (event: any): string {
  const userId = event.context.userId as string | undefined
  if (!userId) {
    throw createError({
      statusCode: 401,
      message: '未登录，请先登录'
    })
  }
  return userId
}

/**
 * 校验资源归属权
 * - 资源的 userId 为 null（历史数据）：允许所有登录用户访问
 * - 资源的 userId 与当前用户不匹配：抛出 403
 */
export function requireResourceOwner (
  resource: { userId?: string | null },
  currentUserId: string
): void {
  // 历史数据兼容：user_id 为 null 的记录允许访问
  if (!resource.userId) return

  if (resource.userId !== currentUserId) {
    throw createError({
      statusCode: 403,
      message: '无权访问此资源'
    })
  }
}

/**
 * 校验对工作区 PRD 资源的访问权限
 *
 * 规则：
 * - 有 workspaceId 的资源（读取）：工作区成员均可访问
 * - 有 workspaceId 的资源（写操作）：创建者本人，或工作区 admin/owner
 * - 无 workspaceId 的资源：退回严格所有者校验（requireResourceOwner）
 *
 * @param resource     资源对象（需有 userId 和可选的 workspaceId）
 * @param currentUserId 当前登录用户 ID
 * @param requireWrite 是否为写操作（删除/修改），写操作要求是创建者或 admin/owner
 */
export async function requirePrdAccess (
  resource: { userId?: string | null; workspaceId?: string | null },
  currentUserId: string,
  requireWrite = false
): Promise<void> {
  if (!resource.workspaceId) {
    // 无工作区：退回严格所有者校验
    requireResourceOwner(resource, currentUserId)
    return
  }

  // 有工作区：先确认是工作区成员
  const result = await dbClient.query<{ role: string }>(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [resource.workspaceId, currentUserId]
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 403, message: '无权访问此工作区资源' })
  }

  if (!requireWrite) return

  // 写操作：创建者本人，或工作区 admin/owner 均可
  const role = result.rows[0].role
  const isAdminOrOwner = ['owner', 'admin'].includes(role)
  const isCreator = resource.userId === currentUserId

  if (!isCreator && !isAdminOrOwner) {
    throw createError({ statusCode: 403, message: '仅创建者或工作区管理员可执行此操作' })
  }
}

/**
 * 验证当前用户是否有工作区指定资源的操作权限（RBAC 精细权限）
 * @param event H3 事件对象
 * @param workspaceId 工作区 ID
 * @param resource 资源类型
 * @param action 操作类型
 * @returns { userId, role }
 */
export async function requireWorkspaceRole (
  event: any,
  workspaceId: string,
  resource: ResourceType,
  action: Action
): Promise<{ userId: string; role: WorkspaceRole }> {
  const userId = requireAuth(event)

  const result = await dbClient.query<{ role: string }>(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 403, message: '无权访问此工作区' })
  }

  const role = result.rows[0].role as WorkspaceRole

  if (!hasPermission(role, resource, action)) {
    throw createError({
      statusCode: 403,
      message: `权限不足：需要 ${resource}:${action} 权限`
    })
  }

  return { userId, role }
}

/**
 * 验证当前用户是否为工作区成员，并返回其角色
 * @deprecated 建议使用 requireWorkspaceRole() 进行精细权限控制
 *
 * 向后兼容别名：等价于 requireWorkspaceRole(event, workspaceId, 'workspace', 'read')
 * @param event H3 事件对象
 * @param workspaceId 工作区 ID
 * @param requiredRole 'admin'：要求 owner 或 admin；'owner'：仅 owner；不传则 viewer 即可
 */
export async function requireWorkspaceMember (
  event: any,
  workspaceId: string,
  requiredRole?: 'admin' | 'owner'
): Promise<{ userId: string; role: string }> {
  const userId = requireAuth(event)

  const result = await dbClient.query<{ role: string }>(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 403, message: '无权访问此工作区' })
  }

  const { role } = result.rows[0]

  if (requiredRole === 'admin' && !['owner', 'admin'].includes(role)) {
    throw createError({ statusCode: 403, message: '需要工作区管理员权限' })
  }
  if (requiredRole === 'owner' && role !== 'owner') {
    throw createError({ statusCode: 403, message: '需要工作区所有者权限' })
  }

  return { userId, role }
}
