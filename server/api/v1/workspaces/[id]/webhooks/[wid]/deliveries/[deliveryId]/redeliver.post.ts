/**
 * 重新投递 Webhook
 * POST /api/v1/workspaces/:id/webhooks/:wid/deliveries/:deliveryId/redeliver
 */

import { createHmac } from 'crypto'
import { WebhookDAO } from '~/lib/db/dao/webhook-dao'
import { WebhookDeliveryDAO } from '~/lib/db/dao/webhook-delivery-dao'
import { dbClient } from '~/lib/db/client'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

const REQUEST_TIMEOUT_MS = 10_000

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const webhookId = getRouterParam(event, 'wid')
  const deliveryId = getRouterParam(event, 'deliveryId')

  if (!workspaceId) throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  if (!webhookId) throw createError({ statusCode: 400, message: 'Webhook ID is required' })
  if (!deliveryId) throw createError({ statusCode: 400, message: 'Delivery ID is required' })

  await requireWorkspaceMember(event, workspaceId, 'admin')

  // 确认 Webhook 属于该工作区（含 secret，用于重新签名）
  const webhook = await WebhookDAO.findById(webhookId, workspaceId)
  if (!webhook) throw createError({ statusCode: 404, message: 'Webhook not found' })

  // 查询原始投递记录
  const result = await dbClient.query<any>(
    'SELECT * FROM webhook_deliveries WHERE id = $1 AND webhook_id = $2',
    [deliveryId, webhookId]
  )
  if (result.rows.length === 0) throw createError({ statusCode: 404, message: 'Delivery not found' })

  const originalDelivery = result.rows[0]
  const payload = typeof originalDelivery.payload === 'string'
    ? JSON.parse(originalDelivery.payload)
    : (originalDelivery.payload ?? {})

  // 重新构造 payload（更新 timestamp）
  const redeliveryPayload = {
    ...payload,
    timestamp: new Date().toISOString(),
    redelivery: true
  }
  const bodyStr = JSON.stringify(redeliveryPayload)
  const signature = createHmac('sha256', webhook.secret).update(bodyStr).digest('hex')
  const startTime = Date.now()

  let statusCode: number | undefined
  let responseBody: string | undefined
  let error: string | undefined
  let success = false

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        ...webhook.headers,
        'Content-Type': 'application/json',
        'User-Agent': 'ArchMind-Webhook/1.0',
        'X-ArchMind-Event': originalDelivery.event,
        'X-ArchMind-Signature': `sha256=${signature}`,
        'X-ArchMind-Timestamp': new Date().toISOString()
      },
      body: bodyStr,
      signal: controller.signal
    }).finally(() => clearTimeout(timer))

    statusCode = response.status
    responseBody = await response.text().catch(() => '')
    success = response.ok
  } catch (err: any) {
    error = err?.name === 'AbortError' ? 'Request timed out' : (err?.message ?? 'Unknown error')
  }

  const durationMs = Date.now() - startTime

  // 记录新的投递日志
  await WebhookDeliveryDAO.create({
    webhookId,
    event: originalDelivery.event,
    payload: redeliveryPayload,
    statusCode,
    responseBody,
    durationMs,
    success,
    error
  })

  return {
    success: true,
    data: {
      success,
      statusCode: statusCode ?? null,
      durationMs,
      error: error ?? null
    }
  }
})
