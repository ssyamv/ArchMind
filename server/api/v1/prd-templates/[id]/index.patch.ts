/**
 * PATCH /api/v1/prd-templates/:id
 * 更新自定义 PRD 模板（不可修改内置模板）
 */

import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth-helpers'
import { PRDTemplateDAO } from '~/lib/db/dao/prd-template-dao'

const SectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  required: z.boolean(),
  instructions: z.string().min(1),
  format: z.string().optional(),
  minWords: z.number().int().positive().optional(),
})

const BodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  sections: z.array(SectionSchema).min(1).optional(),
  systemPrompt: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, BodySchema.parse)

  const template = await PRDTemplateDAO.findById(id)
  if (!template) {
    throw createError({ statusCode: 404, message: '模板不存在' })
  }
  if (template.isBuiltin) {
    throw createError({ statusCode: 403, message: '不可修改内置模板' })
  }
  // 只有模板创建者或工作区管理员可以修改
  if (template.userId !== userId) {
    if (template.workspaceId) {
      await requireWorkspaceRole(event, template.workspaceId, 'prd', 'write')
    } else {
      throw createError({ statusCode: 403, message: '无权修改此模板' })
    }
  }

  const updated = await PRDTemplateDAO.update(id, body)
  return { success: true, data: updated }
})
