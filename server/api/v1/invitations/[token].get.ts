/**
 * 查询邀请详情（公开端点，无需登录）
 * GET /api/v1/invitations/:token
 */

import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'

export default defineEventHandler(async (event) => {
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
    // 更新状态为过期
    await WorkspaceMemberDAO.updateInvitationStatus(token, 'expired')
    throw createError({ statusCode: 410, message: '邀请链接已过期' })
  }

  if (invitation.status !== 'pending') {
    throw createError({
      statusCode: 410,
      message: invitation.status === 'accepted' ? '邀请已被接受' : '邀请链接已过期'
    })
  }

  return {
    success: true,
    data: {
      workspaceName: invitation.workspaceName,
      inviterName: invitation.inviterName,
      email: maskEmail(invitation.email),
      role: invitation.role,
      expiresAt: invitation.expiresAt
    }
  }
})

function maskEmail (email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const masked = local.length <= 2
    ? local[0] + '***'
    : local[0] + '***' + local[local.length - 1]
  return `${masked}@${domain}`
}
