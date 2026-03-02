/**
 * Webhook 触发引擎
 * 在业务事件发生时，向已订阅的 Webhook URL 发送 HTTP 通知
 */

import { createHmac } from 'crypto'
import { WebhookDAO } from '~/lib/db/dao/webhook-dao'
import { WebhookDeliveryDAO } from '~/lib/db/dao/webhook-delivery-dao'
import {
  toFeishuPayload,
  toDingtalkPayload,
  toWecomPayload,
  toSlackPayload,
  toDiscordPayload,
  type StandardPayload
} from './webhook-adapters'
import type { WebhookType } from '~/lib/db/dao/webhook-dao'

/** 支持的 Webhook 事件类型 */
export type WebhookEvent =
  | 'document.uploaded'
  | 'document.completed'
  | 'document.failed'
  | 'prd.generated'
  | 'comment.created'

/** HTTP 请求超时（10s） */
const REQUEST_TIMEOUT_MS = 10_000

/**
 * 计算 HMAC-SHA256 签名
 */
function signPayload (secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * 根据 Webhook 类型将标准负载转换为平台专属格式
 */
function buildPlatformBody (type: WebhookType, payload: StandardPayload): string {
  switch (type) {
    case 'feishu':   return JSON.stringify(toFeishuPayload(payload))
    case 'dingtalk': return JSON.stringify(toDingtalkPayload(payload))
    case 'wecom':    return JSON.stringify(toWecomPayload(payload))
    case 'slack':    return JSON.stringify(toSlackPayload(payload))
    case 'discord':  return JSON.stringify(toDiscordPayload(payload))
    default:         return JSON.stringify(payload)
  }
}

/**
 * 触发工作区内订阅了该事件的所有活跃 Webhook
 * 异步执行，失败不影响主业务流程
 */
export async function triggerWebhooks (
  workspaceId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const webhooks = await WebhookDAO.findActiveByEvent(workspaceId, event)
    if (webhooks.length === 0) return

    const payload: StandardPayload = {
      event,
      workspaceId,
      timestamp: new Date().toISOString(),
      data
    }
    // 标准格式原始 JSON，用于签名和 standard 类型投递
    const standardBodyStr = JSON.stringify(payload)

    // 并行触发所有匹配的 Webhook
    await Promise.allSettled(
      webhooks.map(webhook => deliverWebhook(
        webhook.id,
        webhook.url,
        webhook.secret,
        webhook.headers,
        webhook.type ?? 'standard',
        event,
        payload,
        standardBodyStr
      ))
    )
  } catch (err) {
    console.warn('[WebhookTrigger] Failed to trigger webhooks:', err)
  }
}

/**
 * 向单个 Webhook URL 发送 HTTP 请求并记录投递结果
 */
async function deliverWebhook (
  webhookId: string,
  url: string,
  secret: string,
  customHeaders: Record<string, string>,
  type: WebhookType,
  event: string,
  payload: StandardPayload,
  standardBodyStr: string
): Promise<void> {
  // 平台消息体（飞书/钉钉等走各自格式，standard 走原始 JSON）
  const bodyStr = buildPlatformBody(type, payload)

  // 签名始终基于标准负载，方便接收端做幂等校验
  const signature = signPayload(secret, standardBodyStr)
  const startTime = Date.now()

  let statusCode: number | undefined
  let responseBody: string | undefined
  let error: string | undefined
  let success = false

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    // 平台型 Webhook 不需要 ArchMind 签名头，只保留通用头
    const headers: Record<string, string> = type === 'standard'
      ? {
          ...customHeaders,
          'Content-Type': 'application/json',
          'User-Agent': 'ArchMind-Webhook/1.0',
          'X-ArchMind-Event': event,
          'X-ArchMind-Signature': `sha256=${signature}`,
          'X-ArchMind-Timestamp': new Date().toISOString()
        }
      : {
          ...customHeaders,
          'Content-Type': 'application/json',
          'User-Agent': 'ArchMind-Webhook/1.0'
        }

    const response = await fetch(url, {
      method: 'POST',
      headers,
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

  // 记录投递日志（异步，失败不影响主流程）
  WebhookDeliveryDAO.create({
    webhookId,
    event,
    payload: payload as unknown as Record<string, unknown>,
    statusCode,
    responseBody,
    durationMs,
    success,
    error
  })

  if (!success) {
    console.warn(`[WebhookTrigger] Delivery failed for webhook ${webhookId}: ${error ?? `HTTP ${statusCode}`}`)
  }
}
