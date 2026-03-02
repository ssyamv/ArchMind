/**
 * PRD 质量统计
 * GET /api/v1/stats/prd-quality
 *
 * 返回指定工作区在最近 N 天内的 PRD 用户反馈统计
 */

import { z } from 'zod'
import { PRDFeedbackDAO } from '~/lib/db/dao/prd-feedback-dao'

const QuerySchema = z.object({
  workspaceId: z.string().uuid('workspaceId 必须是有效的 UUID'),
  days: z.coerce.number().int().min(1).max(365).default(30)
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

    const stats = await PRDFeedbackDAO.getQualityStats(
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
