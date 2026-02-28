/**
 * Webhook DAO（数据访问层）
 * 管理工作区的 Webhook 订阅配置
 */

import { dbClient } from '../client'

export interface Webhook {
  id: string
  workspaceId: string
  userId: string
  name: string
  url: string
  events: string[]
  active: boolean
  secret: string
  headers: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface CreateWebhookInput {
  workspaceId: string
  userId: string
  name: string
  url: string
  events: string[]
  secret: string
  headers?: Record<string, string>
}

export interface UpdateWebhookInput {
  name?: string
  url?: string
  events?: string[]
  active?: boolean
  headers?: Record<string, string>
}

export class WebhookDAO {
  /**
   * 创建 Webhook
   */
  static async create (input: CreateWebhookInput): Promise<Webhook> {
    const sql = `
      INSERT INTO webhooks
        (workspace_id, user_id, name, url, events, secret, headers)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, [
      input.workspaceId,
      input.userId,
      input.name,
      input.url,
      JSON.stringify(input.events),
      input.secret,
      JSON.stringify(input.headers ?? {})
    ])
    return this.mapRow(result.rows[0])
  }

  /**
   * 按工作区查询所有 Webhook（不含 secret 字段）
   */
  static async findByWorkspace (
    workspaceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Omit<Webhook, 'secret'>[]> {
    const { limit = 50, offset = 0 } = options ?? {}
    const sql = `
      SELECT id, workspace_id, user_id, name, url, events, active, headers, created_at, updated_at
      FROM webhooks
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `
    const result = await dbClient.query<any>(sql, [workspaceId, limit, offset])
    return result.rows.map(row => this.mapRowWithoutSecret(row))
  }

  /**
   * 按 ID 查询单个 Webhook（含 secret，仅内部使用）
   */
  static async findById (id: string, workspaceId: string): Promise<Webhook | null> {
    const result = await dbClient.query<any>(
      'SELECT * FROM webhooks WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    )
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  /**
   * 查询工作区内订阅了指定事件的所有活跃 Webhook（含 secret，用于触发）
   */
  static async findActiveByEvent (workspaceId: string, event: string): Promise<Webhook[]> {
    const sql = `
      SELECT * FROM webhooks
      WHERE workspace_id = $1
        AND active = true
        AND events @> $2::jsonb
    `
    const result = await dbClient.query<any>(sql, [workspaceId, JSON.stringify([event])])
    return result.rows.map(row => this.mapRow(row))
  }

  /**
   * 更新 Webhook
   */
  static async update (id: string, workspaceId: string, input: UpdateWebhookInput): Promise<Webhook | null> {
    const setClauses: string[] = []
    const params: any[] = []
    let idx = 1

    if (input.name !== undefined) {
      setClauses.push(`name = $${idx++}`)
      params.push(input.name)
    }
    if (input.url !== undefined) {
      setClauses.push(`url = $${idx++}`)
      params.push(input.url)
    }
    if (input.events !== undefined) {
      setClauses.push(`events = $${idx++}`)
      params.push(JSON.stringify(input.events))
    }
    if (input.active !== undefined) {
      setClauses.push(`active = $${idx++}`)
      params.push(input.active)
    }
    if (input.headers !== undefined) {
      setClauses.push(`headers = $${idx++}`)
      params.push(JSON.stringify(input.headers))
    }

    if (setClauses.length === 0) return this.findById(id, workspaceId)

    setClauses.push(`updated_at = NOW()`)
    params.push(id, workspaceId)

    const sql = `
      UPDATE webhooks
      SET ${setClauses.join(', ')}
      WHERE id = $${idx++} AND workspace_id = $${idx}
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, params)
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  /**
   * 删除 Webhook
   */
  static async delete (id: string, workspaceId: string): Promise<boolean> {
    const result = await dbClient.query(
      'DELETE FROM webhooks WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    )
    return (result.rowCount ?? 0) > 0
  }

  /**
   * 统计工作区 Webhook 总数
   */
  static async countByWorkspace (workspaceId: string): Promise<number> {
    const result = await dbClient.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM webhooks WHERE workspace_id = $1',
      [workspaceId]
    )
    return parseInt(result.rows[0].count, 10)
  }

  private static mapRow (row: any): Webhook {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      name: row.name,
      url: row.url,
      events: typeof row.events === 'string' ? JSON.parse(row.events) : (row.events ?? []),
      active: row.active,
      secret: row.secret,
      headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : (row.headers ?? {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  private static mapRowWithoutSecret (row: any): Omit<Webhook, 'secret'> {
    const { secret: _secret, ...rest } = this.mapRow({ ...row, secret: '' })
    return rest
  }
}
