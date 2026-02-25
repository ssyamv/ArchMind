/**
 * 移除工作区成员
 * DELETE /api/v1/workspaces/:id/members/:userId
 */

import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'
import { WorkspaceDAO } from '~/lib/db/dao/workspace-dao'

export default defineEventHandler(async (event) => {
  const currentUserId = requireAuth(event)
  const workspaceId = getRouterParam(event, 'id')
  const targetUserId = getRouterParam(event, 'userId')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: '缺少工作区 ID' })
  }
  if (!targetUserId) {
    throw createError({ statusCode: 400, message: '缺少用户 ID' })
  }

  // 检查工作区是否存在
  const workspace = await WorkspaceDAO.getById(workspaceId)
  if (!workspace) {
    throw createError({ statusCode: 404, message: '工作区不存在' })
  }

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
