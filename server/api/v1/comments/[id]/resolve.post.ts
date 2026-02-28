/**
 * 标记评论为已解决
 * POST /api/v1/comments/:id/resolve
 */

import { CommentDAO } from '~/lib/db/dao/comment-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Comment ID is required' })

  const comment = await CommentDAO.findById(id)
  if (!comment) throw createError({ statusCode: 404, message: '评论不存在' })
  if (comment.resolved) throw createError({ statusCode: 400, message: '评论已是已解决状态' })

  // 需要是评论作者或工作区 admin/owner 才能标记解决
  const { userId, role } = await requireWorkspaceMember(event, comment.workspaceId)
  const canResolve = comment.userId === userId || ['admin', 'owner'].includes(role)
  if (!canResolve) throw createError({ statusCode: 403, message: '无权标记解决此评论，仅作者或管理员可操作' })

  const updated = await CommentDAO.resolve(id, userId)
  if (!updated) throw createError({ statusCode: 404, message: '操作失败' })

  return { success: true, data: updated }
})
