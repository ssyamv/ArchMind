/**
 * 创建评论
 * POST /api/v1/comments
 */

import { z } from 'zod'
import { CommentDAO } from '~/lib/db/dao/comment-dao'
import { ActivityLogDAO } from '~/lib/db/dao/activity-log-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

const BodySchema = z.object({
  workspaceId: z.string().uuid(),
  targetType: z.enum(['document', 'prd', 'prototype']),
  targetId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  mentions: z.array(z.string().uuid()).default([])
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, BodySchema.parse)
  const { userId } = await requireWorkspaceMember(event, body.workspaceId)

  const comment = await CommentDAO.create({
    workspaceId: body.workspaceId,
    targetType: body.targetType,
    targetId: body.targetId,
    userId,
    content: body.content,
    mentions: body.mentions
  })

  // 写入活动日志（异步，失败不影响响应）
  ActivityLogDAO.create({
    workspaceId: body.workspaceId,
    userId,
    action: 'added_comment',
    resourceType: body.targetType,
    resourceId: body.targetId,
    metadata: { commentId: comment.id, mentionCount: body.mentions.length }
  })

  return { success: true, data: comment }
})
