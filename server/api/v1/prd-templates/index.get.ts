/**
 * GET /api/v1/prd-templates
 * 获取可用 PRD 模板列表（内置 + 工作区自定义）
 */

import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth-helpers'
import { PRDTemplateDAO } from '~/lib/db/dao/prd-template-dao'

const QuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const query = await getValidatedQuery(event, QuerySchema.parse)
  const templates = await PRDTemplateDAO.findAvailable(query.workspaceId)
  return { success: true, data: templates }
})
