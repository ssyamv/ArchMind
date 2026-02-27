/**
 * 获取工作区 Webhook 列表
 * GET /api/v1/workspaces/:id/webhooks
 */

import { z } from 'zod'
import { WebhookDAO } from '~/lib/db/dao/webhook-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
})

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) throw createError({ statusCode: 400, message: 'Workspace ID is required' })

  await requireWorkspaceMember(event, workspaceId, 'admin')

  const query = await getValidatedQuery(event, QuerySchema.parse)

  const [webhooks, total] = await Promise.all([
    WebhookDAO.findByWorkspace(workspaceId, { limit: query.limit, offset: query.offset }),
    WebhookDAO.countByWorkspace(workspaceId)
  ])

  return {
    success: true,
    data: webhooks,
    pagination: { total, limit: query.limit, offset: query.offset }
  }
})
