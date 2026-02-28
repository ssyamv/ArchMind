/**
 * 取消工作区邀请
 * DELETE /api/v1/workspaces/:id/members/invitations/:invitationId
 */

import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const workspaceId = getRouterParam(event, 'id')
  const invitationId = getRouterParam(event, 'invitationId')

  if (!workspaceId || !invitationId) {
    throw createError({ statusCode: 400, message: '缺少必要参数' })
  }

  // 只有 admin/owner 才能取消邀请
  await requireWorkspaceMember(event, workspaceId, 'admin')

  const deleted = await WorkspaceMemberDAO.cancelInvitation(invitationId, workspaceId)

  if (!deleted) {
    throw createError({ statusCode: 404, message: '邀请不存在或已被接受/过期' })
  }

  return { success: true, message: '邀请已取消' }
})
