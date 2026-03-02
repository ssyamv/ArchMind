/**
 * 提交/更新 PRD 用户反馈
 * POST /api/v1/prd/:id/feedback
 *
 * 同一用户对同一 PRD 重复提交时执行 upsert（更新）
 */

import { z } from 'zod'
import { PRDFeedbackDAO } from '~/lib/db/dao/prd-feedback-dao'
import { PRDDAO } from '~/lib/db/dao/prd-dao'

const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  positives: z.array(z.string()).optional(),
  negatives: z.array(z.string()).optional(),
  comment: z.string().max(500).optional()
})

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'id')

    if (!prdId) {
      throw createError({ statusCode: 400, message: '缺少 PRD ID' })
    }

    // 验证 PRD 是否存在
    const prd = await PRDDAO.findById(prdId)
    if (!prd) {
      throw createError({ statusCode: 404, message: 'PRD 不存在' })
    }

    // 解析并校验请求体
    const body = await readBody(event)
    const parsed = FeedbackSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        message: parsed.error.errors.map(e => e.message).join(', ')
      })
    }

    const feedback = await PRDFeedbackDAO.upsert({
      prdId,
      userId,
      rating: parsed.data.rating,
      positives: parsed.data.positives,
      negatives: parsed.data.negatives,
      comment: parsed.data.comment
    })

    return {
      success: true,
      data: feedback
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : '服务器错误'
    })
  }
})
