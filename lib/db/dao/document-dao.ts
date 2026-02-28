import { randomUUID } from 'crypto'
import { dbClient } from '../client'
import type { Document } from '@/types/document'

export class DocumentDAO {
  // 创建文档
  static async create (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const sql = `
      INSERT INTO documents (
        id, user_id, workspace_id, title, file_path, file_type, file_size, content, metadata, status,
        storage_provider, storage_bucket, storage_key, content_hash,
        processing_status, processing_error, retry_count, chunks_count, vectors_count,
        processing_started_at, processing_completed_at,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      doc.userId || null,
      doc.workspaceId || null,
      doc.title,
      doc.filePath,
      doc.fileType,
      doc.fileSize,
      doc.content || null,
      JSON.stringify(doc.metadata || {}),
      doc.status || 'uploaded',
      doc.storageProvider || 'local',
      doc.storageBucket || null,
      doc.storageKey || null,
      doc.contentHash || null,
      doc.processingStatus || 'pending',
      doc.processingError || null,
      doc.retryCount || 0,
      doc.chunksCount || 0,
      doc.vectorsCount || 0,
      doc.processingStartedAt || null,
      doc.processingCompletedAt || null,
      now,
      now
    ])

    return this.mapRowToDocument(result.rows[0])
  }

  // 查询单个文档
  static async findById (id: string): Promise<Document | null> {
    const sql = 'SELECT * FROM documents WHERE id = $1'
    const result = await dbClient.query<any>(sql, [id])

    if (result.rows.length === 0) { return null }

    return this.mapRowToDocument(result.rows[0])
  }

  // 批量查询文档（避免 N+1）
  static async findByIds (ids: string[]): Promise<Map<string, Document>> {
    if (ids.length === 0) { return new Map() }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const sql = `SELECT * FROM documents WHERE id IN (${placeholders})`
    const result = await dbClient.query<any>(sql, ids)

    const map = new Map<string, Document>()
    for (const row of result.rows) {
      const doc = this.mapRowToDocument(row)
      map.set(doc.id, doc)
    }
    return map
  }

  // 查询所有文档
  static async findAll (options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'updated_at' | 'title';
    order?: 'ASC' | 'DESC';
    workspaceId?: string;
    userId?: string;
  }): Promise<Document[]> {
    const { limit = 50, offset = 0, orderBy = 'created_at', order = 'DESC', workspaceId, userId } = options || {}

    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (workspaceId) {
      // 查询指定工作区的文档（权限由 API 层校验），不限制 user_id
      whereConditions.push(`workspace_id = $${paramIndex}`)
      params.push(workspaceId)
      paramIndex++
    } else if (userId) {
      // 未指定工作区时，退回到按用户过滤
      whereConditions.push(`(user_id = $${paramIndex} OR user_id IS NULL)`)
      params.push(userId)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    params.push(limit, offset)

    const sql = `
      SELECT * FROM documents
      ${whereClause}
      ORDER BY ${orderBy} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const result = await dbClient.query<any>(sql, params)

    return result.rows.map(row => this.mapRowToDocument(row))
  }

  // 更新文档
  static async update (id: string, updates: Partial<Document>): Promise<Document | null> {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`)
      values.push(updates.title)
    }
    if (updates.content !== undefined) {
      fields.push(`content = $${paramIndex++}`)
      values.push(updates.content)
    }
    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`)
      values.push(JSON.stringify(updates.metadata))
    }
    if (updates.storageProvider !== undefined) {
      fields.push(`storage_provider = $${paramIndex++}`)
      values.push(updates.storageProvider)
    }
    if (updates.storageBucket !== undefined) {
      fields.push(`storage_bucket = $${paramIndex++}`)
      values.push(updates.storageBucket)
    }
    if (updates.storageKey !== undefined) {
      fields.push(`storage_key = $${paramIndex++}`)
      values.push(updates.storageKey)
    }
    if (updates.contentHash !== undefined) {
      fields.push(`content_hash = $${paramIndex++}`)
      values.push(updates.contentHash)
    }
    if (updates.processingStatus !== undefined) {
      fields.push(`processing_status = $${paramIndex++}`)
      values.push(updates.processingStatus)
    }
    if (updates.processingError !== undefined) {
      fields.push(`processing_error = $${paramIndex++}`)
      values.push(updates.processingError)
    }
    if (updates.retryCount !== undefined) {
      fields.push(`retry_count = $${paramIndex++}`)
      values.push(updates.retryCount)
    }
    if (updates.chunksCount !== undefined) {
      fields.push(`chunks_count = $${paramIndex++}`)
      values.push(updates.chunksCount)
    }
    if (updates.vectorsCount !== undefined) {
      fields.push(`vectors_count = $${paramIndex++}`)
      values.push(updates.vectorsCount)
    }
    if (updates.processingStartedAt !== undefined) {
      fields.push(`processing_started_at = $${paramIndex++}`)
      values.push(updates.processingStartedAt)
    }
    if (updates.processingCompletedAt !== undefined) {
      fields.push(`processing_completed_at = $${paramIndex++}`)
      values.push(updates.processingCompletedAt)
    }
    if (updates.currentVersion !== undefined) {
      fields.push(`current_version = $${paramIndex++}`)
      values.push(updates.currentVersion)
    }

    fields.push(`updated_at = $${paramIndex++}`)
    values.push(now)

    if (fields.length === 1) { return this.findById(id) }

    values.push(id)

    const sql = `
      UPDATE documents
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, values)

    if (result.rows.length === 0) { return null }

    return this.mapRowToDocument(result.rows[0])
  }

  // 删除文档
  static async delete (id: string): Promise<boolean> {
    const sql = 'DELETE FROM documents WHERE id = $1'
    const result = await dbClient.query(sql, [id])
    return result.rowCount! > 0
  }

  // 统计文档数量
  static async count (options?: { workspaceId?: string; userId?: string }): Promise<number> {
    const { workspaceId, userId } = options || {}

    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (workspaceId) {
      // 查询指定工作区的文档（权限由 API 层校验），不限制 user_id
      whereConditions.push(`workspace_id = $${paramIndex}`)
      params.push(workspaceId)
      paramIndex++
    } else if (userId) {
      // 未指定工作区时，退回到按用户过滤
      whereConditions.push(`(user_id = $${paramIndex} OR user_id IS NULL)`)
      params.push(userId)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const sql = `SELECT COUNT(*) as count FROM documents ${whereClause}`
    const result = await dbClient.query<{ count: string }>(sql, params)
    return parseInt(result.rows[0].count, 10)
  }

  // 按文件类型查询
  static async findByFileType (fileType: string): Promise<Document[]> {
    const sql = 'SELECT * FROM documents WHERE file_type = $1 ORDER BY created_at DESC'
    const result = await dbClient.query<any>(sql, [fileType])

    return result.rows.map(row => this.mapRowToDocument(row))
  }

  // 按content_hash查找文档（用于去重）
  static async findByHash (contentHash: string): Promise<Document | null> {
    const sql = 'SELECT * FROM documents WHERE content_hash = $1 LIMIT 1'
    const result = await dbClient.query<any>(sql, [contentHash])

    if (result.rows.length === 0) { return null }

    return this.mapRowToDocument(result.rows[0])
  }

  // 更新处理状态
  static async updateProcessingStatus (
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying',
    details?: {
      error?: string;
      chunksCount?: number;
      vectorsCount?: number;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<Document | null> {
    const updates: Partial<Document> = {
      processingStatus: status
    }

    if (details?.error) {
      updates.processingError = details.error
    }
    if (details?.chunksCount !== undefined) {
      updates.chunksCount = details.chunksCount
    }
    if (details?.vectorsCount !== undefined) {
      updates.vectorsCount = details.vectorsCount
    }
    if (details?.startedAt) {
      updates.processingStartedAt = details.startedAt.toISOString()
    }
    if (details?.completedAt) {
      updates.processingCompletedAt = details.completedAt.toISOString()
    }

    return this.update(id, updates)
  }

  private static mapRowToDocument (row: any): Document {
    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      title: row.title,
      filePath: row.file_path,
      fileType: row.file_type,
      fileSize: row.file_size,
      content: row.content,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      status: row.status,
      storageProvider: row.storage_provider,
      storageBucket: row.storage_bucket,
      storageKey: row.storage_key,
      contentHash: row.content_hash,
      processingStatus: row.processing_status,
      processingError: row.processing_error,
      retryCount: row.retry_count,
      chunksCount: row.chunks_count,
      vectorsCount: row.vectors_count,
      processingStartedAt: row.processing_started_at,
      processingCompletedAt: row.processing_completed_at,
      currentVersion: row.current_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
