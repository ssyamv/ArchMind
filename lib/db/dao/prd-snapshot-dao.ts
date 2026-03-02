/**
 * PRD 快照 DAO
 * 管理 prd_snapshots 表的 CRUD 操作
 * 实现 Git 风格的两层版本管理：
 *   - auto：每次保存自动创建（重复内容去重）
 *   - manual：用户显式创建命名版本
 */

import { dbClient } from '../client'

export interface PRDSnapshot {
  id: string
  prdId: string
  createdBy: string
  snapshotType: 'auto' | 'manual'
  tag: string | null
  description: string | null
  content: string
  contentSize: number
  createdAt: string
}

export type PRDSnapshotListItem = Omit<PRDSnapshot, 'content'>

export interface CreateSnapshotInput {
  prdId: string
  createdBy: string
  snapshotType: 'auto' | 'manual'
  content: string
  tag?: string
  description?: string
}

export class PRDSnapshotDAO {
  /**
   * 创建快照
   * - auto 类型：先检查最近一条 auto 快照是否与当前内容相同，相同则跳过（去重），返回 null
   * - manual 类型：直接创建
   */
  static async create (input: CreateSnapshotInput): Promise<PRDSnapshot | null> {
    // auto 快照去重
    if (input.snapshotType === 'auto') {
      const dedupeResult = await dbClient.query<any>(
        `SELECT content_size, content FROM prd_snapshots
         WHERE prd_id = $1 AND snapshot_type = 'auto'
         ORDER BY created_at DESC LIMIT 1`,
        [input.prdId]
      )
      if (dedupeResult.rows.length > 0) {
        const last = dedupeResult.rows[0]
        if (last.content_size === input.content.length && last.content === input.content) {
          return null // 内容相同，跳过
        }
      }
    }

    const result = await dbClient.query<any>(
      `INSERT INTO prd_snapshots
         (prd_id, created_by, snapshot_type, tag, description, content, content_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.prdId,
        input.createdBy,
        input.snapshotType,
        input.tag ?? null,
        input.description ?? null,
        input.content,
        input.content.length
      ]
    )
    return this.mapRow(result.rows[0])
  }

  /**
   * 列出某 PRD 的快照（不含 content 字段，节省传输）
   * 按 created_at DESC 排序
   */
  static async list (
    prdId: string,
    options?: { type?: string; limit?: number; offset?: number }
  ): Promise<PRDSnapshotListItem[]> {
    const conditions = ['prd_id = $1']
    const params: any[] = [prdId]
    let paramIndex = 2

    if (options?.type) {
      conditions.push(`snapshot_type = $${paramIndex++}`)
      params.push(options.type)
    }

    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    params.push(limit, offset)

    const sql = `
      SELECT id, prd_id, created_by, snapshot_type, tag, description, content_size, created_at
      FROM prd_snapshots
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `
    const result = await dbClient.query<any>(sql, params)
    return result.rows.map(row => this.mapListRow(row))
  }

  /**
   * 获取单个快照（含 content，用于恢复和对比）
   */
  static async findById (id: string): Promise<PRDSnapshot | null> {
    const result = await dbClient.query<any>(
      'SELECT * FROM prd_snapshots WHERE id = $1 LIMIT 1',
      [id]
    )
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null
  }

  /**
   * 获取快照并联查 prd_documents.user_id，用于所有权校验
   */
  static async findByIdWithOwner (id: string): Promise<(PRDSnapshotListItem & { prdUserId: string }) | null> {
    const result = await dbClient.query<any>(
      `SELECT s.id, s.prd_id, s.created_by, s.snapshot_type, s.tag, s.description,
              s.content_size, s.created_at, pd.user_id AS prd_user_id
       FROM prd_snapshots s
       JOIN prd_documents pd ON pd.id = s.prd_id
       WHERE s.id = $1 LIMIT 1`,
      [id]
    )
    if (result.rows.length === 0) return null
    const row = result.rows[0]
    return {
      ...this.mapListRow(row),
      prdUserId: row.prd_user_id
    }
  }

  /**
   * 删除快照
   */
  static async delete (id: string): Promise<void> {
    await dbClient.query('DELETE FROM prd_snapshots WHERE id = $1', [id])
  }

  /**
   * 清理 auto 快照：只保留最新 keepCount 条
   * 用于 create 之后 fire-and-forget 调用，防止无限增长
   */
  static async pruneAutoSnapshots (prdId: string, keepCount: number = 50): Promise<void> {
    await dbClient.query(
      `DELETE FROM prd_snapshots
       WHERE prd_id = $1
         AND snapshot_type = 'auto'
         AND id NOT IN (
           SELECT id FROM prd_snapshots
           WHERE prd_id = $1 AND snapshot_type = 'auto'
           ORDER BY created_at DESC
           LIMIT $2
         )`,
      [prdId, keepCount]
    )
  }

  private static mapRow (row: any): PRDSnapshot {
    return {
      id: row.id,
      prdId: row.prd_id,
      createdBy: row.created_by,
      snapshotType: row.snapshot_type,
      tag: row.tag ?? null,
      description: row.description ?? null,
      content: row.content,
      contentSize: Number(row.content_size ?? 0),
      createdAt: row.created_at
    }
  }

  private static mapListRow (row: any): PRDSnapshotListItem {
    return {
      id: row.id,
      prdId: row.prd_id,
      createdBy: row.created_by,
      snapshotType: row.snapshot_type,
      tag: row.tag ?? null,
      description: row.description ?? null,
      contentSize: Number(row.content_size ?? 0),
      createdAt: row.created_at
    }
  }
}
