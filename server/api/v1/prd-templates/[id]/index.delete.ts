/**
 * DELETE /api/v1/prd-templates/:id
 * 删除自定义 PRD 模板（需 editor+ 权限）
 */

import { z } from 'zod'
import { requireWorkspaceRole } from '~/server/utils/auth-helpers'
import { PRDTemplateDAO } from '~/lib/db/dao/prd-template-dao'

const QuerySchema = z.object({
  workspaceId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const query = await getValidatedQuery(event, QuerySchema.parse)
  await requireWorkspaceRole(event, query.workspaceId, 'prd', 'write')

  const template = await PRDTemplateDAO.findById(id)
  if (!template) {
    throw createError({ statusCode: 404, message: '模板不存在' })
  }
  if (template.isBuiltin) {
    throw createError({ statusCode: 403, message: '不可删除内置模板' })
  }

  const deleted = await PRDTemplateDAO.delete(id, query.workspaceId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '模板不存在或无权限' })
  }
  return { success: true }
})
