/**
 * 接受工作区邀请（需要登录）
 * POST /api/v1/invitations/:token/accept
 */

import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'
import { dbClient } from '~/lib/db/client'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, message: '缺少邀请 token' })
  }

  const invitation = await WorkspaceMemberDAO.getInvitationByToken(token)

  if (!invitation) {
    throw createError({ statusCode: 404, message: '邀请不存在或已失效' })
  }

  // 检查是否过期
  if (new Date(invitation.expiresAt) < new Date()) {
    await WorkspaceMemberDAO.updateInvitationStatus(token, 'expired')
    throw createError({ statusCode: 410, message: '邀请链接已过期' })
  }

  if (invitation.status !== 'pending') {
    throw createError({
      statusCode: 410,
      message: invitation.status === 'accepted' ? '邀请已被接受' : '邀请链接已过期'
    })
  }

  // 验证当前登录用户邮箱是否与邀请邮箱匹配
  const userResult = await dbClient.query<any>(
    'SELECT email FROM users WHERE id = $1',
    [userId]
  )
  if (userResult.rows.length === 0) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  if (userResult.rows[0].email !== invitation.email) {
    throw createError({
      statusCode: 403,
      message: '当前账号邮箱与邀请邮箱不匹配，请使用被邀请的邮箱账号登录'
    })
  }

  // 检查是否已是成员
  const alreadyMember = await WorkspaceMemberDAO.isMember(invitation.workspaceId, userId)
  if (alreadyMember) {
    throw createError({ statusCode: 409, message: '您已经是该工作区成员' })
  }

  // 添加成员并更新邀请状态
  const role = invitation.role as 'admin' | 'member'
  const [member] = await Promise.all([
    WorkspaceMemberDAO.addMember(invitation.workspaceId, userId, role),
    WorkspaceMemberDAO.updateInvitationStatus(token, 'accepted')
  ])

  return {
    success: true,
    data: {
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspaceName,
      role: member.role
    },
    message: `已成功加入工作区 ${invitation.workspaceName}`
  }
})
