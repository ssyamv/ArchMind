/**
 * RAG 检索质量统计
 * GET /api/v1/stats/rag-retrieval
 *
 * 返回指定工作区在最近 N 天内的 RAG 检索质量统计
 */

import { z } from 'zod'
import { RAGRetrievalLogDAO } from '~/lib/db/dao/rag-retrieval-log-dao'

const QuerySchema = z.object({
  workspaceId: z.string().uuid('workspaceId 必须是有效的 UUID'),
  days: z.coerce.number().int().min(1).max(90).default(7)
})

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)

    const query = getQuery(event)
    const parsed = QuerySchema.safeParse(query)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        message: parsed.error.errors.map(e => e.message).join(', ')
      })
    }

    const stats = await RAGRetrievalLogDAO.getStats(
      parsed.data.workspaceId,
      parsed.data.days
    )

    return {
      success: true,
      data: stats
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : '服务器错误'
    })
  }
})
