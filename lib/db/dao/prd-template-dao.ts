/**
 * PRD 模板 DAO（#67）
 */

import { randomUUID } from 'crypto'
import { dbClient } from '../client'

export interface PRDTemplateSection {
  id: string
  title: string
  required: boolean
  instructions: string
  format?: string
  minWords?: number
}

export interface PRDTemplate {
  id: string
  workspaceId: string | null
  userId: string | null
  name: string
  description: string | null
  type: string
  sections: PRDTemplateSection[]
  systemPrompt: string | null
  isBuiltin: boolean
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface CreatePRDTemplateInput {
  workspaceId?: string | null
  userId?: string | null
  name: string
  description?: string | null
  type: string
  sections: PRDTemplateSection[]
  systemPrompt?: string | null
  isBuiltin?: boolean
  isPublic?: boolean
}

export class PRDTemplateDAO {
  static async findById (id: string): Promise<PRDTemplate | null> {
    const result = await dbClient.query<any>(
      'SELECT * FROM prd_templates WHERE id = $1',
      [id]
    )
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  /** 获取可用模板列表（内置 + 公开 + 工作区自定义） */
  static async findAvailable (workspaceId?: string): Promise<PRDTemplate[]> {
    const params: any[] = []
    let sql = 'SELECT * FROM prd_templates WHERE is_builtin = true OR is_public = true'
    if (workspaceId) {
      sql += ' OR workspace_id = $1'
      params.push(workspaceId)
    }
    sql += ' ORDER BY is_builtin DESC, created_at ASC'
    const result = await dbClient.query<any>(sql, params)
    return result.rows.map(r => this.mapRow(r))
  }

  static async create (input: CreatePRDTemplateInput): Promise<PRDTemplate> {
    const id = randomUUID()
    const now = new Date().toISOString()
    const sql = `
      INSERT INTO prd_templates
        (id, workspace_id, user_id, name, description, type, sections, system_prompt, is_builtin, is_public, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, [
      id, input.workspaceId ?? null, input.userId ?? null,
      input.name, input.description ?? null, input.type,
      JSON.stringify(input.sections), input.systemPrompt ?? null,
      input.isBuiltin ?? false, input.isPublic ?? false, now, now,
    ])
    return this.mapRow(result.rows[0])
  }

  static async update (id: string, updates: Partial<Pick<PRDTemplate, 'name' | 'description' | 'sections' | 'systemPrompt'>>): Promise<PRDTemplate | null> {
    const sets: string[] = []
    const params: any[] = []
    let idx = 1

    if (updates.name !== undefined) { sets.push(`name = $${idx++}`); params.push(updates.name) }
    if (updates.description !== undefined) { sets.push(`description = $${idx++}`); params.push(updates.description) }
    if (updates.sections !== undefined) { sets.push(`sections = $${idx++}`); params.push(JSON.stringify(updates.sections)) }
    if (updates.systemPrompt !== undefined) { sets.push(`system_prompt = $${idx++}`); params.push(updates.systemPrompt) }

    if (sets.length === 0) return this.findById(id)

    sets.push(`updated_at = $${idx++}`)
    params.push(new Date().toISOString())
    params.push(id)

    const result = await dbClient.query<any>(
      `UPDATE prd_templates SET ${sets.join(', ')} WHERE id = $${idx} AND is_builtin = false RETURNING *`,
      params
    )
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async delete (id: string, workspaceId: string): Promise<boolean> {
    const result = await dbClient.query(
      'DELETE FROM prd_templates WHERE id = $1 AND workspace_id = $2 AND is_builtin = false',
      [id, workspaceId]
    )
    return (result.rowCount ?? 0) > 0
  }

  static mapRow (row: any): PRDTemplate {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      sections: typeof row.sections === 'string' ? JSON.parse(row.sections) : row.sections,
      systemPrompt: row.system_prompt,
      isBuiltin: row.is_builtin,
      isPublic: row.is_public ?? false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

export const prdTemplateDAO = PRDTemplateDAO
