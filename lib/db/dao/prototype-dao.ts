import { randomUUID } from 'crypto'
import { dbClient } from '../client'
import type { Prototype, PrototypePage, PrototypeVersion, DeviceType } from '@/types/prototype'

export class PrototypeDAO {
  static async create (data: Omit<Prototype, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prototype> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const sql = `
      INSERT INTO prototypes (
        id, prd_id, user_id, title, description,
        current_version, status, device_type, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      data.prdId || null,
      data.userId || null,
      data.title,
      data.description || null,
      data.currentVersion || 1,
      data.status || 'draft',
      data.deviceType || 'responsive',
      JSON.stringify(data.metadata || {}),
      now,
      now
    ])

    return this.mapRow(result.rows[0])
  }

  static async findById (id: string): Promise<Prototype | null> {
    const sql = 'SELECT * FROM prototypes WHERE id = $1'
    const result = await dbClient.query<any>(sql, [id])
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async findByPrdId (prdId: string): Promise<Prototype[]> {
    const sql = 'SELECT * FROM prototypes WHERE prd_id = $1 ORDER BY created_at DESC'
    const result = await dbClient.query<any>(sql, [prdId])
    return result.rows.map(row => this.mapRow(row))
  }

  static async findAll (options?: {
    limit?: number
    offset?: number
    orderBy?: 'created_at' | 'updated_at'
    order?: 'ASC' | 'DESC'
    workspaceId?: string
    userId?: string
  }): Promise<Prototype[]> {
    const { limit = 50, offset = 0, orderBy = 'created_at', order = 'DESC', workspaceId, userId } = options || {}

    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (userId) {
      whereConditions.push(`(p.user_id = $${paramIndex} OR p.user_id IS NULL)`)
      params.push(userId)
      paramIndex++
    }

    if (workspaceId) {
      // 通过 JOIN prd_documents 间接过滤工作区
      const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''
      params.push(workspaceId, limit, offset)
      const sql = `
        SELECT p.* FROM prototypes p
        LEFT JOIN prd_documents prd ON p.prd_id = prd.id
        WHERE (prd.workspace_id = $${paramIndex} OR (p.prd_id IS NULL AND $${paramIndex} = 'default'))
        ${whereClause}
        ORDER BY p.${orderBy} ${order}
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `
      const result = await dbClient.query<any>(sql, params)
      return result.rows.map(row => this.mapRow(row))
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    params.push(limit, offset)

    const sql = `
      SELECT * FROM prototypes p
      ${whereClause}
      ORDER BY p.${orderBy} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    const result = await dbClient.query<any>(sql, params)
    return result.rows.map(row => this.mapRow(row))
  }

  static async update (id: string, data: Partial<Prototype>): Promise<Prototype | null> {
    const fields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (data.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(data.title) }
    if (data.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(data.description) }
    if (data.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(data.status) }
    if (data.currentVersion !== undefined) { fields.push(`current_version = $${paramIndex++}`); values.push(data.currentVersion) }
    if (data.deviceType !== undefined) { fields.push(`device_type = $${paramIndex++}`); values.push(data.deviceType) }
    if (data.metadata !== undefined) { fields.push(`metadata = $${paramIndex++}`); values.push(JSON.stringify(data.metadata)) }

    if (fields.length === 0) return this.findById(id)

    values.push(id)
    const sql = `UPDATE prototypes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`
    const result = await dbClient.query<any>(sql, values)
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async delete (id: string): Promise<boolean> {
    const sql = 'DELETE FROM prototypes WHERE id = $1'
    const result = await dbClient.query(sql, [id])
    return result.rowCount! > 0
  }

  static async count (options?: { workspaceId?: string; userId?: string }): Promise<number> {
    const { workspaceId, userId } = options || {}

    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (userId) {
      whereConditions.push(`(p.user_id = $${paramIndex} OR p.user_id IS NULL)`)
      params.push(userId)
      paramIndex++
    }

    if (workspaceId) {
      const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''
      params.push(workspaceId)
      const sql = `
        SELECT COUNT(*) as count FROM prototypes p
        LEFT JOIN prd_documents prd ON p.prd_id = prd.id
        WHERE (prd.workspace_id = $${paramIndex} OR (p.prd_id IS NULL AND $${paramIndex} = 'default'))
        ${whereClause}
      `
      const result = await dbClient.query<{ count: string }>(sql, params)
      return parseInt(result.rows[0].count, 10)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const sql = `SELECT COUNT(*) as count FROM prototypes p ${whereClause}`
    const result = await dbClient.query<{ count: string }>(sql, params)
    return parseInt(result.rows[0].count, 10)
  }

  private static mapRow (row: any): Prototype {
    return {
      id: row.id,
      prdId: row.prd_id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      currentVersion: row.current_version,
      status: row.status,
      deviceType: (row.device_type as DeviceType) || 'responsive',
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

export class PrototypePageDAO {
  static async create (data: Omit<PrototypePage, 'id' | 'createdAt' | 'updatedAt'>): Promise<PrototypePage> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const sql = `
      INSERT INTO prototype_pages (
        id, prototype_id, page_name, page_slug, html_content,
        sort_order, is_entry_page, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      data.prototypeId,
      data.pageName,
      data.pageSlug,
      data.htmlContent,
      data.sortOrder || 0,
      data.isEntryPage || false,
      JSON.stringify(data.metadata || {}),
      now,
      now
    ])

    return this.mapRow(result.rows[0])
  }

  static async batchCreate (pages: Array<Omit<PrototypePage, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PrototypePage[]> {
    if (pages.length === 0) return []

    const now = new Date().toISOString()
    const valueParts: string[] = []
    const params: any[] = []
    let paramIdx = 1

    for (const page of pages) {
      const id = randomUUID()
      valueParts.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9})`)
      params.push(
        id,
        page.prototypeId,
        page.pageName,
        page.pageSlug,
        page.htmlContent,
        page.sortOrder || 0,
        page.isEntryPage || false,
        JSON.stringify(page.metadata || {}),
        now,
        now
      )
      paramIdx += 10
    }

    const sql = `
      INSERT INTO prototype_pages (
        id, prototype_id, page_name, page_slug, html_content,
        sort_order, is_entry_page, metadata, created_at, updated_at
      )
      VALUES ${valueParts.join(', ')}
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, params)
    return result.rows.map(row => this.mapRow(row))
  }

  static async findByPrototypeId (prototypeId: string): Promise<PrototypePage[]> {
    const sql = 'SELECT * FROM prototype_pages WHERE prototype_id = $1 ORDER BY sort_order ASC, created_at ASC'
    const result = await dbClient.query<any>(sql, [prototypeId])
    return result.rows.map(row => this.mapRow(row))
  }

  static async findById (id: string): Promise<PrototypePage | null> {
    const sql = 'SELECT * FROM prototype_pages WHERE id = $1'
    const result = await dbClient.query<any>(sql, [id])
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async update (id: string, data: Partial<PrototypePage>): Promise<PrototypePage | null> {
    const fields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (data.pageName !== undefined) { fields.push(`page_name = $${paramIndex++}`); values.push(data.pageName) }
    if (data.htmlContent !== undefined) { fields.push(`html_content = $${paramIndex++}`); values.push(data.htmlContent) }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${paramIndex++}`); values.push(data.sortOrder) }
    if (data.isEntryPage !== undefined) { fields.push(`is_entry_page = $${paramIndex++}`); values.push(data.isEntryPage) }
    if (data.metadata !== undefined) { fields.push(`metadata = $${paramIndex++}`); values.push(JSON.stringify(data.metadata)) }

    if (fields.length === 0) return this.findById(id)

    values.push(id)
    const sql = `UPDATE prototype_pages SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`
    const result = await dbClient.query<any>(sql, values)
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async delete (id: string): Promise<boolean> {
    const sql = 'DELETE FROM prototype_pages WHERE id = $1'
    const result = await dbClient.query(sql, [id])
    return result.rowCount! > 0
  }

  private static mapRow (row: any): PrototypePage {
    return {
      id: row.id,
      prototypeId: row.prototype_id,
      pageName: row.page_name,
      pageSlug: row.page_slug,
      htmlContent: row.html_content,
      sortOrder: row.sort_order,
      isEntryPage: row.is_entry_page,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

export class PrototypeVersionDAO {
  static async create (data: Omit<PrototypeVersion, 'id' | 'createdAt'>): Promise<PrototypeVersion> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const sql = `
      INSERT INTO prototype_versions (
        id, prototype_id, version_number, pages_snapshot,
        commit_message, model_used, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      data.prototypeId,
      data.versionNumber,
      JSON.stringify(data.pagesSnapshot),
      data.commitMessage || null,
      data.modelUsed || null,
      now
    ])

    return this.mapRow(result.rows[0])
  }

  static async findByPrototypeId (prototypeId: string): Promise<PrototypeVersion[]> {
    const sql = 'SELECT * FROM prototype_versions WHERE prototype_id = $1 ORDER BY version_number DESC'
    const result = await dbClient.query<any>(sql, [prototypeId])
    return result.rows.map(row => this.mapRow(row))
  }

  static async findByVersion (prototypeId: string, versionNumber: number): Promise<PrototypeVersion | null> {
    const sql = 'SELECT * FROM prototype_versions WHERE prototype_id = $1 AND version_number = $2'
    const result = await dbClient.query<any>(sql, [prototypeId, versionNumber])
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  private static mapRow (row: any): PrototypeVersion {
    const snapshot = typeof row.pages_snapshot === 'string'
      ? JSON.parse(row.pages_snapshot)
      : row.pages_snapshot

    return {
      id: row.id,
      prototypeId: row.prototype_id,
      versionNumber: row.version_number,
      pagesSnapshot: snapshot,
      commitMessage: row.commit_message,
      modelUsed: row.model_used,
      createdAt: row.created_at
    }
  }
}
