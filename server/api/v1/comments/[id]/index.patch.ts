/**
 * 更新评论
 * PATCH /api/v1/comments/:id
 */

import { z } from 'zod'
import { CommentDAO } from '~/lib/db/dao/comment-dao'
import { requireAuth } from '~/server/utils/auth-helpers'

const BodySchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  mentions: z.array(z.string().uuid()).optional()
}).refine(data => data.content !== undefined || data.mentions !== undefined, {
  message: '至少需要提供 content 或 mentions 之一'
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Comment ID is required' })

  const userId = requireAuth(event)
  const body = await readValidatedBody(event, BodySchema.parse)

  const comment = await CommentDAO.findById(id)
  if (!comment) throw createError({ statusCode: 404, message: '评论不存在' })
  if (comment.userId !== userId) throw createError({ statusCode: 403, message: '无权修改此评论' })

  const updated = await CommentDAO.update(id, userId, body)
  if (!updated) throw createError({ statusCode: 404, message: '更新失败' })

  return { success: true, data: updated }
})
