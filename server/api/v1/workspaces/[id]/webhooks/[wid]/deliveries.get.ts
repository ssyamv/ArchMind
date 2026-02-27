/**
 * 查看 Webhook 投递历史
 * GET /api/v1/workspaces/:id/webhooks/:wid/deliveries
 */

import { z } from 'zod'
import { WebhookDAO } from '~/lib/db/dao/webhook-dao'
import { WebhookDeliveryDAO } from '~/lib/db/dao/webhook-delivery-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
})

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const webhookId = getRouterParam(event, 'wid')
  if (!workspaceId) throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  if (!webhookId) throw createError({ statusCode: 400, message: 'Webhook ID is required' })

  await requireWorkspaceMember(event, workspaceId, 'admin')

  // 确认 Webhook 属于该工作区
  const webhook = await WebhookDAO.findById(webhookId, workspaceId)
  if (!webhook) throw createError({ statusCode: 404, message: 'Webhook not found' })

  const query = await getValidatedQuery(event, QuerySchema.parse)

  const [deliveries, total] = await Promise.all([
    WebhookDeliveryDAO.findByWebhook(webhookId, { limit: query.limit, offset: query.offset }),
    WebhookDeliveryDAO.countByWebhook(webhookId)
  ])

  return {
    success: true,
    data: deliveries,
    pagination: { total, limit: query.limit, offset: query.offset }
  }
})
