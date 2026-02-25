/**
 * 邀请成员加入工作区
 * POST /api/v1/workspaces/:id/members/invite
 */

import { z } from 'zod'
import { nanoid } from 'nanoid'
import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'
import { WorkspaceDAO } from '~/lib/db/dao/workspace-dao'
import { dbClient } from '~/lib/db/client'
import { sendWorkspaceInvitationEmail } from '~/server/utils/email'

const InviteSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  role: z.enum(['admin', 'member']).default('member')
})

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const workspaceId = getRouterParam(event, 'id')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: '缺少工作区 ID' })
  }

  const body = await readValidatedBody(event, InviteSchema.parse)

  // 检查工作区是否存在
  const workspace = await WorkspaceDAO.getById(workspaceId)
  if (!workspace) {
    throw createError({ statusCode: 404, message: '工作区不存在' })
  }

  // 获取邀请人信息
  const inviterResult = await dbClient.query<any>(
    'SELECT full_name, email, username FROM users WHERE id = $1',
    [userId]
  )
  if (inviterResult.rows.length === 0) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }
  const inviter = inviterResult.rows[0]
  const inviterName = inviter.full_name || inviter.username || inviter.email

  // 检查被邀请邮箱是否已是成员
  const targetUserResult = await dbClient.query<any>(
    'SELECT id FROM users WHERE email = $1',
    [body.email]
  )

  if (targetUserResult.rows.length > 0) {
    const targetUserId = targetUserResult.rows[0].id
    const alreadyMember = await WorkspaceMemberDAO.isMember(workspaceId, targetUserId)
    if (alreadyMember) {
      throw createError({ statusCode: 409, message: '该用户已是工作区成员' })
    }
  }

  // 检查是否已有待处理邀请
  const hasPending = await WorkspaceMemberDAO.hasPendingInvitation(workspaceId, body.email)
  if (hasPending) {
    throw createError({ statusCode: 409, message: '该邮箱已有待处理的邀请' })
  }

  // 生成邀请 token（24 位）
  const token = nanoid(24)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 天后

  // 创建邀请记录
  const invitation = await WorkspaceMemberDAO.createInvitation({
    workspaceId,
    inviterId: userId,
    email: body.email,
    role: body.role,
    token,
    expiresAt
  })

  // 构建邀请链接
  const config = useRuntimeConfig()
  const appUrl = (config.appUrl as string) || process.env.APP_URL || 'http://localhost:3000'
  const inviteUrl = `${appUrl}/invite/${token}`

  // 发送邀请邮件
  await sendWorkspaceInvitationEmail({
    email: body.email,
    inviterName,
    workspaceName: workspace.name,
    inviteUrl,
    role: body.role
  })

  return {
    success: true,
    data: {
      invitation,
      inviteUrl
    },
    message: `邀请已发送至 ${body.email}`
  }
})
