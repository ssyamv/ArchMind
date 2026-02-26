/**
 * 获取工作区成员列表
 * GET /api/v1/workspaces/:id/members
 */

import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: '缺少工作区 ID' })
  }

  // 验证用户是该工作区成员，同时隐含检查了工作区是否存在
  await requireWorkspaceMember(event, workspaceId)

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
