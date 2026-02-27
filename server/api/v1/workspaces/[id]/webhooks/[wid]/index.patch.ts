/**
 * 更新 Webhook
 * PATCH /api/v1/workspaces/:id/webhooks/:wid
 */

import { z } from 'zod'
import { WebhookDAO } from '~/lib/db/dao/webhook-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

const SUPPORTED_EVENTS = [
  'document.uploaded',
  'document.completed',
  'document.failed',
  'prd.generated',
  'comment.created'
] as const

const BodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(SUPPORTED_EVENTS)).min(1).optional(),
  active: z.boolean().optional(),
  headers: z.record(z.string()).optional()
})

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const webhookId = getRouterParam(event, 'wid')
  if (!workspaceId) throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  if (!webhookId) throw createError({ statusCode: 400, message: 'Webhook ID is required' })

  await requireWorkspaceMember(event, workspaceId, 'admin')

  const body = await readValidatedBody(event, BodySchema.parse)

  const updated = await WebhookDAO.update(webhookId, workspaceId, body)
  if (!updated) throw createError({ statusCode: 404, message: 'Webhook not found' })

  // 不返回 secret
  const { secret: _secret, ...rest } = updated
  return { success: true, data: rest }
})
