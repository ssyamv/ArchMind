/**
 * 活动日志 DAO（工作区动态流）
 * 面向用户展示的操作时间线，区别于安全审计的 audit_logs
 */

import { dbClient } from '../client'

export interface ActivityLog {
  id: string
  workspaceId: string
  userId: string
  username: string
  avatarUrl?: string
  action: string
  resourceType?: string
  resourceId?: string
  resourceName?: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface CreateActivityLogInput {
  workspaceId: string
  userId: string
  action: string
  resourceType?: string
  resourceId?: string
  resourceName?: string
  metadata?: Record<string, unknown>
}

export class ActivityLogDAO {
  /**
   * 写入一条活动日志（失败时静默处理，不影响主业务）
   */
  static async create (input: CreateActivityLogInput): Promise<void> {
    try {
      const sql = `
        INSERT INTO activity_logs
          (workspace_id, user_id, action, resource_type, resource_id, resource_name, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `
      await dbClient.query(sql, [
        input.workspaceId,
        input.userId,
        input.action,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.resourceName ?? null,
        JSON.stringify(input.metadata ?? {})
      ])
    } catch (err) {
      console.warn('[ActivityLog] Failed to write activity log:', err)
    }
  }

  /**
   * 按工作区分页查询活动日志（含用户信息）
   */
  static async findByWorkspace (
    workspaceId: string,
    options?: { limit?: number; offset?: number; action?: string; userId?: string }
  ): Promise<ActivityLog[]> {
    const { limit = 50, offset = 0, action, userId } = options ?? {}
    const params: any[] = [workspaceId]
    const conditions: string[] = ['al.workspace_id = $1']
    let idx = 2

    if (action) {
      conditions.push(`al.action = $${idx++}`)
      params.push(action)
    }
    if (userId) {
      conditions.push(`al.user_id = $${idx++}`)
      params.push(userId)
    }

    params.push(limit, offset)
    const sql = `
      SELECT al.*, u.username, u.avatar_url
      FROM activity_logs al
      JOIN users u ON u.id = al.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY al.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `
    const result = await dbClient.query<any>(sql, params)
    return result.rows.map(this.mapRow)
  }

  /**
   * 查询工作区活动总数
   */
  static async countByWorkspace (workspaceId: string): Promise<number> {
    const result = await dbClient.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM activity_logs WHERE workspace_id = $1',
      [workspaceId]
    )
    return parseInt(result.rows[0].count, 10)
  }

  private static mapRow (row: any): ActivityLog {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      username: row.username ?? '',
      avatarUrl: row.avatar_url ?? undefined,
      action: row.action,
      resourceType: row.resource_type ?? undefined,
      resourceId: row.resource_id ?? undefined,
      resourceName: row.resource_name ?? undefined,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      createdAt: row.created_at
    }
  }
}
