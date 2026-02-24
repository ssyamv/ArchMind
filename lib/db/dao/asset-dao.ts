import { randomUUID } from 'crypto'
import { dbClient } from '../client'
import type { Asset, PrdAsset } from '@/types/asset'

export class AssetDAO {
  static async create (data: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const sql = `
      INSERT INTO assets (
        id, user_id, title, description, file_name, file_type, file_size,
        storage_provider, storage_bucket, storage_key, content_hash,
        source, generation_prompt, model_used, metadata,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      data.userId || null,
      data.title,
      data.description || null,
      data.fileName,
      data.fileType,
      data.fileSize,
      data.storageProvider || 'huawei-obs',
      data.storageBucket || null,
      data.storageKey,
      data.contentHash || null,
      data.source,
      data.generationPrompt || null,
      data.modelUsed || null,
      JSON.stringify(data.metadata || {}),
      now,
      now
    ])

    return this.mapRow(result.rows[0])
  }

  static async findById (id: string): Promise<Asset | null> {
    const sql = 'SELECT * FROM assets WHERE id = $1'
    const result = await dbClient.query<any>(sql, [id])
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async findByHash (contentHash: string): Promise<Asset | null> {
    const sql = 'SELECT * FROM assets WHERE content_hash = $1 LIMIT 1'
    const result = await dbClient.query<any>(sql, [contentHash])
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async findAll (options?: {
    limit?: number
    offset?: number
    source?: 'upload' | 'ai-generated'
    orderBy?: 'created_at' | 'updated_at'
    order?: 'ASC' | 'DESC'
    userId?: string
  }): Promise<Asset[]> {
    const { limit = 50, offset = 0, source, orderBy = 'created_at', order = 'DESC', userId } = options || {}

    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (userId) {
      whereConditions.push(`(user_id = $${paramIndex} OR user_id IS NULL)`)
      params.push(userId)
      paramIndex++
    }

    if (source) {
      whereConditions.push(`source = $${paramIndex}`)
      params.push(source)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    params.push(limit, offset)
    const sql = `SELECT * FROM assets ${whereClause} ORDER BY ${orderBy} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`

    const result = await dbClient.query<any>(sql, params)
    return result.rows.map(row => this.mapRow(row))
  }

  static async delete (id: string): Promise<boolean> {
    const sql = 'DELETE FROM assets WHERE id = $1'
    const result = await dbClient.query(sql, [id])
    return result.rowCount! > 0
  }

  static async count (options?: { source?: 'upload' | 'ai-generated'; userId?: string }): Promise<number> {
    const { source, userId } = options || {}

    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (userId) {
      whereConditions.push(`(user_id = $${paramIndex} OR user_id IS NULL)`)
      params.push(userId)
      paramIndex++
    }

    if (source) {
      whereConditions.push(`source = $${paramIndex}`)
      params.push(source)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const sql = `SELECT COUNT(*) as count FROM assets ${whereClause}`
    const result = await dbClient.query<{ count: string }>(sql, params)
    return parseInt(result.rows[0].count, 10)
  }

  private static mapRow (row: any): Asset {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      storageProvider: row.storage_provider,
      storageBucket: row.storage_bucket,
      storageKey: row.storage_key,
      contentHash: row.content_hash,
      source: row.source,
      generationPrompt: row.generation_prompt,
      modelUsed: row.model_used,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

export class PrdAssetDAO {
  static async create (data: Omit<PrdAsset, 'id' | 'createdAt'>): Promise<PrdAsset> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const sql = `
      INSERT INTO prd_assets (id, prd_id, asset_id, added_by, sort_order, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      data.prdId,
      data.assetId,
      data.addedBy || 'manual',
      data.sortOrder || 0,
      now
    ])

    return this.mapRow(result.rows[0])
  }

  static async findByPrdId (prdId: string): Promise<PrdAsset[]> {
    const sql = `
      SELECT pa.*,
        a.id as asset_id, a.user_id, a.title, a.description, a.file_name, a.file_type, a.file_size,
        a.storage_provider, a.storage_bucket, a.storage_key, a.content_hash,
        a.source, a.generation_prompt, a.model_used, a.metadata,
        a.created_at as asset_created_at, a.updated_at as asset_updated_at
      FROM prd_assets pa
      LEFT JOIN assets a ON pa.asset_id = a.id
      WHERE pa.prd_id = $1
      ORDER BY pa.sort_order ASC, pa.created_at DESC
    `
    const result = await dbClient.query<any>(sql, [prdId])
    return result.rows.map(row => this.mapRowWithAsset(row))
  }

  static async delete (prdId: string, assetId: string): Promise<boolean> {
    const sql = 'DELETE FROM prd_assets WHERE prd_id = $1 AND asset_id = $2'
    const result = await dbClient.query(sql, [prdId, assetId])
    return result.rowCount! > 0
  }

  private static mapRow (row: any): PrdAsset {
    return {
      id: row.id,
      prdId: row.prd_id,
      assetId: row.asset_id,
      addedBy: row.added_by,
      sortOrder: row.sort_order,
      createdAt: row.created_at
    }
  }

  private static mapRowWithAsset (row: any): PrdAsset {
    const prdAsset = this.mapRow(row)

    if (row.asset_id) {
      prdAsset.asset = {
        id: row.asset_id,
        userId: row.user_id,
        title: row.title,
        description: row.description,
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: row.file_size,
        storageProvider: row.storage_provider,
        storageBucket: row.storage_bucket,
        storageKey: row.storage_key,
        contentHash: row.content_hash,
        source: row.source,
        generationPrompt: row.generation_prompt,
        modelUsed: row.model_used,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        createdAt: row.asset_created_at,
        updatedAt: row.asset_updated_at
      }
    }

    return prdAsset
  }
}
