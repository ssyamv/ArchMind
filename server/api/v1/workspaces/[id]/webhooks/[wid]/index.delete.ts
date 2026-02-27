/**
 * 删除 Webhook
 * DELETE /api/v1/workspaces/:id/webhooks/:wid
 */

import { WebhookDAO } from '~/lib/db/dao/webhook-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const webhookId = getRouterParam(event, 'wid')
  if (!workspaceId) throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  if (!webhookId) throw createError({ statusCode: 400, message: 'Webhook ID is required' })

  await requireWorkspaceMember(event, workspaceId, 'admin')

  const deleted = await WebhookDAO.delete(webhookId, workspaceId)
  if (!deleted) throw createError({ statusCode: 404, message: 'Webhook not found' })

  return { success: true }
})
