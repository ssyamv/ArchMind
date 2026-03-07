/**
 * GET /api/v1/workspaces/:id/roles
 * 获取工作区角色定义及权限矩阵
 */

import { PERMISSION_MATRIX, ROLE_LEVELS, ROLE_DESCRIPTIONS } from '~/lib/auth/permissions'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) {
    throw createError({ statusCode: 400, message: '工作区 ID 不能为空' })
  }

  await requireWorkspaceMember(event, workspaceId)

  const roles = Object.entries(ROLE_DESCRIPTIONS).map(([role, info]) => ({
    role,
    level: ROLE_LEVELS[role as keyof typeof ROLE_LEVELS] ?? 0,
    ...info,
    permissions: Object.entries(PERMISSION_MATRIX)
      .filter(([, required]) => (ROLE_LEVELS[role as keyof typeof ROLE_LEVELS] ?? 0) >= required)
      .map(([key]) => key),
  }))

  return {
    success: true,
    data: {
      roles,
      permissionMatrix: PERMISSION_MATRIX,
    },
  }
})
