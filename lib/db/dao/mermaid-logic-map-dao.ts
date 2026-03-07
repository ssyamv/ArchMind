/**
 * Mermaid 格式逻辑图谱 DAO
 * 支持 flowchart / sequence / state / class 四种图形类型
 */

import { randomUUID } from 'crypto'
import { dbClient } from '../client'

export interface MermaidLogicMap {
  id: string
  workspaceId: string
  prdId: string | null
  userId: string
  title: string
  type: 'flowchart' | 'sequence' | 'state' | 'class'
  mermaidCode: string
  svgCache: string | null
  focus: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMermaidLogicMapInput {
  workspaceId: string
  prdId?: string | null
  userId: string
  title: string
  type: MermaidLogicMap['type']
  mermaidCode: string
  focus?: string | null
}

export class MermaidLogicMapDAO {
  static async create (input: CreateMermaidLogicMapInput): Promise<MermaidLogicMap> {
    const id = randomUUID()
    const now = new Date().toISOString()
    const sql = `
      INSERT INTO mermaid_logic_maps (id, workspace_id, prd_id, user_id, title, type, mermaid_code, focus, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, [
      id, input.workspaceId, input.prdId || null, input.userId,
      input.title, input.type, input.mermaidCode, input.focus || null, now, now,
    ])
    return this.mapRow(result.rows[0])
  }

  static async findById (id: string): Promise<MermaidLogicMap | null> {
    const result = await dbClient.query<any>('SELECT * FROM mermaid_logic_maps WHERE id = $1', [id])
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async findByWorkspace (workspaceId: string, options?: {
    prdId?: string; type?: string; limit?: number; offset?: number
  }): Promise<{ items: MermaidLogicMap[]; total: number }> {
    const conditions: string[] = ['workspace_id = $1']
    const params: any[] = [workspaceId]
    let idx = 2

    if (options?.prdId) {
      conditions.push(`prd_id = $${idx++}`)
      params.push(options.prdId)
    }

    if (options?.type) {
      conditions.push(`type = $${idx++}`)
      params.push(options.type)
    }

    const where = conditions.join(' AND ')
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    const [dataResult, countResult] = await Promise.all([
      dbClient.query<any>(
        `SELECT * FROM mermaid_logic_maps WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      dbClient.query<any>(`SELECT COUNT(*) FROM mermaid_logic_maps WHERE ${where}`, params),
    ])

    return {
      items: dataResult.rows.map(r => this.mapRow(r)),
      total: parseInt(countResult.rows[0].count, 10),
    }
  }

  static async update (id: string, updates: {
    title?: string; mermaidCode?: string; svgCache?: string | null
  }): Promise<MermaidLogicMap | null> {
    const sets: string[] = []
    const params: any[] = []
    let idx = 1

    if (updates.title !== undefined) { sets.push(`title = $${idx++}`); params.push(updates.title) }
    if (updates.mermaidCode !== undefined) { sets.push(`mermaid_code = $${idx++}`); params.push(updates.mermaidCode) }
    if (updates.svgCache !== undefined) { sets.push(`svg_cache = $${idx++}`); params.push(updates.svgCache) }

    if (sets.length === 0) return this.findById(id)

    sets.push(`updated_at = $${idx++}`)
    params.push(new Date().toISOString())
    params.push(id)

    const result = await dbClient.query<any>(
      `UPDATE mermaid_logic_maps SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    )
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async delete (id: string): Promise<boolean> {
    const result = await dbClient.query('DELETE FROM mermaid_logic_maps WHERE id = $1', [id])
    return result.rowCount! > 0
  }

  private static mapRow (row: any): MermaidLogicMap {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      prdId: row.prd_id,
      userId: row.user_id,
      title: row.title,
      type: row.type,
      mermaidCode: row.mermaid_code,
      svgCache: row.svg_cache,
      focus: row.focus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
