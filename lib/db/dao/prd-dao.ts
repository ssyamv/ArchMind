import { randomUUID } from 'crypto'
import type { PoolClient } from 'pg'
import { dbClient } from '../client'
import type { PRDDocument, PRDDocumentReference } from '@/types/prd'

export class PRDDAO {
  // 创建 PRD 文档
  static async create (prd: Omit<PRDDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<PRDDocument> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const sql = `
      INSERT INTO prd_documents (
        id, user_id, workspace_id, title, content, user_input, model_used,
        generation_time, token_count, estimated_cost, status, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      prd.userId || null,
      prd.workspaceId || null,
      prd.title,
      prd.content,
      prd.userInput,
      prd.modelUsed,
      prd.generationTime || null,
      prd.tokenCount || null,
      prd.estimatedCost || null,
      prd.status || 'draft',
      JSON.stringify(prd.metadata || {}),
      now,
      now
    ])

    return this.mapRowToPRD(result.rows[0])
  }

  // 查询单个 PRD
  static async findById (id: string): Promise<PRDDocument | null> {
    const sql = 'SELECT * FROM prd_documents WHERE id = $1'
    const result = await dbClient.query<any>(sql, [id])

    if (result.rows.length === 0) { return null }

    return this.mapRowToPRD(result.rows[0])
  }

  // 批量查询 PRD（避免 N+1）
  static async findByIds (ids: string[]): Promise<Map<string, PRDDocument>> {
    if (ids.length === 0) { return new Map() }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const sql = `SELECT * FROM prd_documents WHERE id IN (${placeholders})`
    const result = await dbClient.query<any>(sql, ids)

    const map = new Map<string, PRDDocument>()
    for (const row of result.rows) {
      const prd = this.mapRowToPRD(row)
      map.set(prd.id, prd)
    }
    return map
  }

  // 查询所有 PRD
  static async findAll (options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'updated_at';
    order?: 'ASC' | 'DESC';
    onlyWithContent?: boolean;
    workspaceId?: string;
    userId?: string;
  }): Promise<PRDDocument[]> {
    const { limit = 50, offset = 0, orderBy = 'created_at', order = 'DESC', onlyWithContent = false, workspaceId, userId } = options || {}

    // 构建 WHERE 条件
    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (userId) {
      whereConditions.push(`(user_id = $${paramIndex} OR user_id IS NULL)`)
      params.push(userId)
      paramIndex++
    }

    if (onlyWithContent) {
      whereConditions.push("content IS NOT NULL AND content != '' AND (metadata->>'hasPrdContent')::boolean = true")
    }

    if (workspaceId) {
      whereConditions.push(`workspace_id = $${paramIndex}`)
      params.push(workspaceId)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 添加 limit 和 offset 参数
    params.push(limit, offset)

    const sql = `
      SELECT * FROM prd_documents
      ${whereClause}
      ORDER BY ${orderBy} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const result = await dbClient.query<any>(sql, params)

    return result.rows.map(row => this.mapRowToPRD(row))
  }

  // 添加文档引用
  static async addReferences (prdId: string, documentIds: string[], relevanceScores?: number[]): Promise<void> {
    if (documentIds.length === 0) { return }

    const values: any[] = []
    let paramIndex = 1
    const sqlParts: string[] = []

    for (let i = 0; i < documentIds.length; i++) {
      const id = randomUUID()
      sqlParts.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`)
      values.push(id, prdId, documentIds[i], relevanceScores?.[i] || null)
      paramIndex += 4
    }

    const sql = `
      INSERT INTO prd_document_references (id, prd_id, document_id, relevance_score)
      VALUES ${sqlParts.join(', ')}
      ON CONFLICT (prd_id, document_id) DO NOTHING
    `

    await dbClient.query(sql, values)
  }

  // 事务版本：在已有的 PoolClient 中创建 PRD（供事务使用）
  static async createWithClient (client: PoolClient, prd: Omit<PRDDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<PRDDocument> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const sql = `
      INSERT INTO prd_documents (
        id, user_id, workspace_id, title, content, user_input, model_used,
        generation_time, token_count, estimated_cost, status, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `

    const result = await client.query<any>(sql, [
      id,
      prd.userId || null,
      prd.workspaceId || null,
      prd.title,
      prd.content,
      prd.userInput,
      prd.modelUsed,
      prd.generationTime || null,
      prd.tokenCount || null,
      prd.estimatedCost || null,
      prd.status || 'draft',
      JSON.stringify(prd.metadata || {}),
      now,
      now
    ])

    return this.mapRowToPRD(result.rows[0])
  }

  // 事务版本：在已有的 PoolClient 中添加文档引用
  static async addReferencesWithClient (client: PoolClient, prdId: string, documentIds: string[], relevanceScores?: number[]): Promise<void> {
    if (documentIds.length === 0) { return }

    const values: any[] = []
    let paramIndex = 1
    const sqlParts: string[] = []

    for (let i = 0; i < documentIds.length; i++) {
      const id = randomUUID()
      sqlParts.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`)
      values.push(id, prdId, documentIds[i], relevanceScores?.[i] || null)
      paramIndex += 4
    }

    const sql = `
      INSERT INTO prd_document_references (id, prd_id, document_id, relevance_score)
      VALUES ${sqlParts.join(', ')}
      ON CONFLICT (prd_id, document_id) DO NOTHING
    `

    await client.query(sql, values)
  }

  // 获取 PRD 的引用文档
  static async getReferences (prdId: string): Promise<PRDDocumentReference[]> {
    const sql = `
      SELECT * FROM prd_document_references
      WHERE prd_id = $1
      ORDER BY relevance_score DESC NULLS LAST
    `

    const result = await dbClient.query<any>(sql, [prdId])

    return result.rows.map(row => ({
      id: row.id,
      prdId: row.prd_id,
      documentId: row.document_id,
      relevanceScore: row.relevance_score
    }))
  }

  // 查找引用了特定文档的所有 PRD
  static async findPRDsByDocumentId (documentId: string): Promise<PRDDocumentReference[]> {
    const sql = `
      SELECT * FROM prd_document_references
      WHERE document_id = $1
      ORDER BY relevance_score DESC NULLS LAST
    `

    const result = await dbClient.query<any>(sql, [documentId])

    return result.rows.map(row => ({
      id: row.id,
      prdId: row.prd_id,
      documentId: row.document_id,
      relevanceScore: row.relevance_score
    }))
  }

  // 更新 PRD
  static async update (id: string, updates: Partial<Omit<PRDDocument, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PRDDocument | null> {
    const now = new Date().toISOString()

    const setClauses: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // 构建 SET 子句
    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex}`)
      values.push(updates.title)
      paramIndex++
    }
    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIndex}`)
      values.push(updates.content)
      paramIndex++
    }
    if (updates.userInput !== undefined) {
      setClauses.push(`user_input = $${paramIndex}`)
      values.push(updates.userInput)
      paramIndex++
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`)
      values.push(updates.status)
      paramIndex++
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex}`)
      values.push(JSON.stringify(updates.metadata))
      paramIndex++
    }

    // 始终更新 updated_at
    setClauses.push(`updated_at = $${paramIndex}`)
    values.push(now)
    paramIndex++

    // 如果没有要更新的字段,直接返回当前记录
    if (setClauses.length === 1) {
      return this.findById(id)
    }

    // 添加 WHERE 子句的 ID
    values.push(id)

    const sql = `
      UPDATE prd_documents
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, values)

    if (result.rows.length === 0) { return null }

    return this.mapRowToPRD(result.rows[0])
  }

  // 删除 PRD
  static async delete (id: string): Promise<boolean> {
    const sql = 'DELETE FROM prd_documents WHERE id = $1'
    const result = await dbClient.query(sql, [id])
    return result.rowCount! > 0
  }

  // 统计 PRD 数量
  static async count (options?: { onlyWithContent?: boolean; workspaceId?: string; userId?: string }): Promise<number> {
    const { onlyWithContent = false, workspaceId, userId } = options || {}

    // 构建 WHERE 条件
    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (userId) {
      whereConditions.push(`(user_id = $${paramIndex} OR user_id IS NULL)`)
      params.push(userId)
      paramIndex++
    }

    if (onlyWithContent) {
      whereConditions.push("content IS NOT NULL AND content != '' AND (metadata->>'hasPrdContent')::boolean = true")
    }

    if (workspaceId) {
      whereConditions.push(`workspace_id = $${paramIndex}`)
      params.push(workspaceId)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const sql = `SELECT COUNT(*) as count FROM prd_documents ${whereClause}`
    const result = await dbClient.query<{ count: string }>(sql, params)
    return parseInt(result.rows[0].count, 10)
  }

  private static mapRowToPRD (row: any): PRDDocument {
    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      title: row.title,
      content: row.content,
      userInput: row.user_input,
      modelUsed: row.model_used,
      generationTime: row.generation_time,
      tokenCount: row.token_count,
      estimatedCost: row.estimated_cost,
      status: row.status,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
