/**
 * 移除工作区成员
 * DELETE /api/v1/workspaces/:id/members/:userId
 */

import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const targetUserId = getRouterParam(event, 'userId')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: '缺少工作区 ID' })
  }
  if (!targetUserId) {
    throw createError({ statusCode: 400, message: '缺少用户 ID' })
  }

  // 验证操作者是该工作区的管理员或 owner
  const { userId: currentUserId } = await requireWorkspaceMember(event, workspaceId, 'admin')

  // 不允许移除自己
  if (targetUserId === currentUserId) {
    throw createError({ statusCode: 400, message: '不能移除自己' })
  }

  const removed = await WorkspaceMemberDAO.removeMember(workspaceId, targetUserId)
  if (!removed) {
    throw createError({ statusCode: 404, message: '该用户不是此工作区成员' })
  }

  return {
    success: true,
    message: '成员已移除'
  }
})
