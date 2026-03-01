/**
 * 获取当前用户对 PRD 的反馈
 * GET /api/v1/prd/:id/feedback
 *
 * 返回当前用户对该 PRD 的反馈，无反馈则返回 null
 */

import { PRDFeedbackDAO } from '~/lib/db/dao/prd-feedback-dao'
import { PRDDAO } from '~/lib/db/dao/prd-dao'

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

    const feedback = await PRDFeedbackDAO.findByPrdAndUser(prdId, userId)

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
