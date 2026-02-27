/**
 * 删除评论
 * DELETE /api/v1/comments/:id
 */

import { CommentDAO } from '~/lib/db/dao/comment-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Comment ID is required' })

  const comment = await CommentDAO.findById(id)
  if (!comment) throw createError({ statusCode: 404, message: '评论不存在' })

  const { userId, role } = await requireWorkspaceMember(event, comment.workspaceId)

  // 只有评论作者或工作区 admin/owner 可以删除
  const canDelete = comment.userId === userId || ['admin', 'owner'].includes(role)
  if (!canDelete) throw createError({ statusCode: 403, message: '无权删除此评论' })

  await CommentDAO.delete(id)

  return { success: true }
})
