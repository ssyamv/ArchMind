/**
 * 认证工具函数
 *
 * 提供 API 端点中常用的认证和权限校验方法。
 * 放在 server/utils/ 下由 Nuxt 自动导入。
 */

import { dbClient } from '~/lib/db/client'

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
 * 验证当前用户是否为工作区成员，并返回其角色
 * @param event H3 事件对象
 * @param workspaceId 工作区 ID
 * @param requiredRole 'admin'：要求 owner 或 admin；'owner'：仅 owner；不传则 member 即可
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
