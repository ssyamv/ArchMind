/**
 * GET /api/v1/workspaces/:id/permissions
 * 获取当前用户在工作区的有效权限列表
 */

import { ROLE_LEVELS, getRolePermissions, type WorkspaceRole } from '~/lib/auth/permissions'
import { dbClient } from '~/lib/db/client'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) {
    throw createError({ statusCode: 400, message: '工作区 ID 不能为空' })
  }

  const userId = requireAuth(event)

  const result = await dbClient.query<{ role: string }>(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  )

  if (result.rows.length === 0) {
    throw createError({ statusCode: 403, message: '无权访问此工作区' })
  }

  const role = result.rows[0].role as WorkspaceRole
  const permissions = getRolePermissions(role)

  return {
    success: true,
    data: {
      role,
      roleLevel: ROLE_LEVELS[role] ?? 0,
      permissions,
    },
  }
})
