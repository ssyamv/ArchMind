/**
 * PATCH /api/v1/workspaces/:id/members/:userId/role
 * 修改工作区成员角色（需要 admin+ 权限）
 */

import { z } from 'zod'
import { ROLE_LEVELS, type WorkspaceRole } from '~/lib/auth/permissions'
import { dbClient } from '~/lib/db/client'

const Schema = z.object({
  role: z.enum(['editor', 'viewer', 'guest', 'admin']), // owner 不可通过 API 修改
})

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const targetUserId = getRouterParam(event, 'userId')

  if (!workspaceId || !targetUserId) {
    throw createError({ statusCode: 400, message: '参数不能为空' })
  }

  // 操作者需要 admin+ 权限
  const { userId: operatorId, role: operatorRole } = await requireWorkspaceMember(event, workspaceId, 'admin')

  // 不能修改自己的角色
  if (operatorId === targetUserId) {
    throw createError({ statusCode: 400, message: '不能修改自己的角色' })
  }

  // 验证请求体
  const body = await readValidatedBody(event, Schema.parse)

  // 查询目标成员的当前角色
  const targetResult = await dbClient.query<{ role: string }>(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, targetUserId]
  )

  if (targetResult.rows.length === 0) {
    throw createError({ statusCode: 404, message: '目标用户不是工作区成员' })
  }

  const targetRole = targetResult.rows[0].role as WorkspaceRole
  const newRole = body.role as WorkspaceRole

  // 不能修改 owner 角色
  if (targetRole === 'owner') {
    throw createError({ statusCode: 403, message: '不能修改工作区所有者的角色' })
  }

  // 不能将角色设置为高于操作者的角色等级
  if (ROLE_LEVELS[newRole] >= ROLE_LEVELS[operatorRole as WorkspaceRole]) {
    throw createError({ statusCode: 403, message: '不能将成员角色设置为高于或等于自身角色' })
  }

  await dbClient.query(
    'UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3',
    [newRole, workspaceId, targetUserId]
  )

  return {
    success: true,
    data: { userId: targetUserId, role: newRole },
    message: '角色已更新',
  }
})
