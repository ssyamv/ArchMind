/**
 * 获取目标资源的评论列表
 * GET /api/v1/comments?targetType=prd&targetId=xxx&workspaceId=xxx
 */

import { z } from 'zod'
import { CommentDAO } from '~/lib/db/dao/comment-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

const QuerySchema = z.object({
  targetType: z.enum(['document', 'prd', 'prototype']),
  targetId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  includeResolved: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse)

  await requireWorkspaceMember(event, query.workspaceId)

  const comments = await CommentDAO.findByTarget(
    query.targetType,
    query.targetId,
    query.workspaceId,
    { includeResolved: query.includeResolved, limit: query.limit, offset: query.offset }
  )

  return { success: true, data: comments }
})
