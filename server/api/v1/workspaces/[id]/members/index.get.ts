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

  // 将对象键格式的头像 URL 转换为代理 URL（与 /api/v1/auth/me 保持一致）
  const resolvedMembers = members.map(member => ({
    ...member,
    userAvatarUrl: member.userAvatarUrl?.startsWith('avatars/')
      ? `/api/v1/user/avatar/${member.userId}`
      : member.userAvatarUrl
  }))

  return {
    success: true,
    data: {
      members: resolvedMembers,
      pendingInvitations
    }
  }
})
