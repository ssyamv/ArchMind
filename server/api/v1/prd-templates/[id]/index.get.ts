/**
 * GET /api/v1/prd-templates/:id
 * 获取 PRD 模板详情
 */

import { requireAuth } from '~/server/utils/auth-helpers'
import { PRDTemplateDAO } from '~/lib/db/dao/prd-template-dao'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const template = await PRDTemplateDAO.findById(id)
  if (!template) {
    throw createError({ statusCode: 404, message: '模板不存在' })
  }
  return { success: true, data: template }
})
