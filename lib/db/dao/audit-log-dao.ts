/**
 * 审计日志 DAO
 * 记录关键用户操作，用于安全审计和问题排查
 */

import { dbClient } from '../client'

export interface AuditLog {
  id: string
  userId: string | null
  workspaceId: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  status: 'success' | 'failure'
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, any>
  errorMessage: string | null
  createdAt: string
}

export interface CreateAuditLogInput {
  userId?: string | null
  workspaceId?: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | null
  status?: 'success' | 'failure'
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, any>
  errorMessage?: string | null
}

export class AuditLogDAO {
  /**
   * 写入一条审计日志
   * 失败时静默处理，不影响主业务流程
   */
  static async create (input: CreateAuditLogInput): Promise<void> {
    try {
      const sql = `
        INSERT INTO audit_logs (
          user_id, workspace_id, action, resource_type, resource_id,
          status, ip_address, user_agent, metadata, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `
      await dbClient.query(sql, [
        input.userId || null,
        input.workspaceId || null,
        input.action,
        input.resourceType || null,
        input.resourceId || null,
        input.status || 'success',
        input.ipAddress || null,
        input.userAgent || null,
        JSON.stringify(input.metadata || {}),
        input.errorMessage || null
      ])
    } catch (err) {
      // 审计日志写入失败不应影响主业务
      console.warn('[AuditLog] Failed to write audit log:', err)
    }
  }

  /**
   * 按用户查询审计日志
   */
  static async findByUser (
    userId: string,
    options?: { limit?: number; offset?: number; action?: string }
  ): Promise<AuditLog[]> {
    const { limit = 50, offset = 0, action } = options || {}
    const params: any[] = [userId]
    let paramIndex = 2

    let whereExtra = ''
    if (action) {
      whereExtra = ` AND action = $${paramIndex}`
      params.push(action)
      paramIndex++
    }

    params.push(limit, offset)
    const sql = `
      SELECT * FROM audit_logs
      WHERE user_id = $1${whereExtra}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    const result = await dbClient.query<any>(sql, params)
    return result.rows.map(this.mapRow)
  }

  /**
   * 按工作区查询审计日志
   */
  static async findByWorkspace (
    workspaceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditLog[]> {
    const { limit = 50, offset = 0 } = options || {}
    const sql = `
      SELECT * FROM audit_logs
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `
    const result = await dbClient.query<any>(sql, [workspaceId, limit, offset])
    return result.rows.map(this.mapRow)
  }

  private static mapRow (row: any): AuditLog {
    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      status: row.status,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
      errorMessage: row.error_message,
      createdAt: row.created_at
    }
  }
}
