/**
 * 更新评论
 * PATCH /api/v1/comments/:id
 */

import { z } from 'zod'
import { CommentDAO } from '~/lib/db/dao/comment-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

const BodySchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  mentions: z.array(z.string().uuid()).optional()
}).refine(data => data.content !== undefined || data.mentions !== undefined, {
  message: '至少需要提供 content 或 mentions 之一'
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Comment ID is required' })

  const body = await readValidatedBody(event, BodySchema.parse)

  const comment = await CommentDAO.findById(id)
  if (!comment) throw createError({ statusCode: 404, message: '评论不存在' })

  // 校验用户是该工作区的成员（防止跨工作区访问），且只有作者可修改内容
  const { userId } = await requireWorkspaceMember(event, comment.workspaceId)
  if (comment.userId !== userId) throw createError({ statusCode: 403, message: '无权修改此评论' })

  const updated = await CommentDAO.update(id, userId, body)
  if (!updated) throw createError({ statusCode: 404, message: '更新失败' })

  return { success: true, data: updated }
})
