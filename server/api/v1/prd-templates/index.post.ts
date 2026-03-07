/**
 * POST /api/v1/prd-templates
 * 创建自定义 PRD 模板（需 editor+ 权限）
 */

import { z } from 'zod'
import { requireWorkspaceRole } from '~/server/utils/auth-helpers'
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
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.string().min(1),
  sections: z.array(SectionSchema).min(1),
  systemPrompt: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, BodySchema.parse)
  const { userId } = await requireWorkspaceRole(event, body.workspaceId, 'prd', 'write')

  const template = await PRDTemplateDAO.create({
    workspaceId: body.workspaceId,
    userId,
    name: body.name,
    description: body.description ?? null,
    type: body.type,
    sections: body.sections,
    systemPrompt: body.systemPrompt ?? null,
    isBuiltin: false,
  })

  return { success: true, data: template }
})
