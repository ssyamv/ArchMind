/**
 * 创建 Webhook
 * POST /api/v1/workspaces/:id/webhooks
 */

import { z } from 'zod'
import { randomBytes } from 'crypto'
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
  name: z.string().min(1).max(255),
  url: z.string().url(),
  events: z.array(z.enum(SUPPORTED_EVENTS)).min(1),
  headers: z.record(z.string()).optional()
})

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) throw createError({ statusCode: 400, message: 'Workspace ID is required' })

  const { userId } = await requireWorkspaceMember(event, workspaceId, 'admin')

  const body = await readValidatedBody(event, BodySchema.parse)

  // 自动生成 HMAC 签名密钥
  const secret = randomBytes(32).toString('hex')

  const webhook = await WebhookDAO.create({
    workspaceId,
    userId,
    name: body.name,
    url: body.url,
    events: body.events,
    secret,
    headers: body.headers ?? {}
  })

  // 响应中包含 secret，仅此一次返回（后续不再展示）
  setResponseStatus(event, 201)
  return { success: true, data: { ...webhook, secret } }
})
