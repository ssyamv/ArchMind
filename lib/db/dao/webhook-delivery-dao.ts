/**
 * Webhook 投递日志 DAO
 * 记录每次 Webhook 触发的结果
 */

import { dbClient } from '../client'

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: string
  payload: Record<string, unknown>
  statusCode: number | null
  responseBody: string | null
  durationMs: number | null
  success: boolean
  error: string | null
  createdAt: string
}

export interface CreateWebhookDeliveryInput {
  webhookId: string
  event: string
  payload: Record<string, unknown>
  statusCode?: number
  responseBody?: string
  durationMs?: number
  success: boolean
  error?: string
}

export class WebhookDeliveryDAO {
  /**
   * 记录一次 Webhook 投递（失败时静默处理，不影响主业务）
   */
  static async create (input: CreateWebhookDeliveryInput): Promise<void> {
    try {
      const sql = `
        INSERT INTO webhook_deliveries
          (webhook_id, event, payload, status_code, response_body, duration_ms, success, error)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `
      await dbClient.query(sql, [
        input.webhookId,
        input.event,
        JSON.stringify(input.payload),
        input.statusCode ?? null,
        input.responseBody ?? null,
        input.durationMs ?? null,
        input.success,
        input.error ?? null
      ])
    } catch (err) {
      console.warn('[WebhookDelivery] Failed to record delivery:', err)
    }
  }

  /**
   * 按 Webhook ID 分页查询投递历史
   */
  static async findByWebhook (
    webhookId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<WebhookDelivery[]> {
    const { limit = 50, offset = 0 } = options ?? {}
    const sql = `
      SELECT * FROM webhook_deliveries
      WHERE webhook_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `
    const result = await dbClient.query<any>(sql, [webhookId, limit, offset])
    return result.rows.map(this.mapRow)
  }

  /**
   * 统计 Webhook 投递总数
   */
  static async countByWebhook (webhookId: string): Promise<number> {
    const result = await dbClient.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM webhook_deliveries WHERE webhook_id = $1',
      [webhookId]
    )
    return parseInt(result.rows[0].count, 10)
  }

  private static mapRow (row: any): WebhookDelivery {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      event: row.event,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload ?? {}),
      statusCode: row.status_code ?? null,
      responseBody: row.response_body ?? null,
      durationMs: row.duration_ms ?? null,
      success: row.success,
      error: row.error ?? null,
      createdAt: row.created_at
    }
  }
}
