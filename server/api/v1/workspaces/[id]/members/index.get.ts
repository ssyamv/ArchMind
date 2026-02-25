/**
 * 获取工作区成员列表
 * GET /api/v1/workspaces/:id/members
 */

import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'
import { WorkspaceDAO } from '~/lib/db/dao/workspace-dao'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const workspaceId = getRouterParam(event, 'id')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: '缺少工作区 ID' })
  }

  // 检查工作区是否存在
  const workspace = await WorkspaceDAO.getById(workspaceId)
  if (!workspace) {
    throw createError({ statusCode: 404, message: '工作区不存在' })
  }

  const [members, pendingInvitations] = await Promise.all([
    WorkspaceMemberDAO.getMembers(workspaceId),
    WorkspaceMemberDAO.getPendingInvitations(workspaceId)
  ])

  return {
    success: true,
    data: {
      members,
      pendingInvitations
    }
  }
})
