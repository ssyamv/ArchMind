/**
 * 工作区 DAO
 */

import { dbClient } from '../client'

export interface Workspace {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  currentUserRole?: 'owner' | 'admin' | 'member'
}

export interface CreateWorkspaceInput {
  name: string
  description?: string
  icon?: string
  color?: string
  isDefault?: boolean
}

export interface UpdateWorkspaceInput {
  name?: string
  description?: string
  icon?: string
  color?: string
  isDefault?: boolean
}

export class WorkspaceDAO {
  /**
   * 获取所有工作区（仅限内部/管理用途）
   */
  static async getAll (): Promise<Workspace[]> {
    const sql = `
      SELECT * FROM workspaces
      ORDER BY is_default DESC, created_at ASC
    `
    const result = await dbClient.query<any>(sql)
    return result.rows.map(row => this.mapRowToWorkspace(row))
  }

  /**
   * 获取用户所属的工作区（通过 workspace_members 过滤，含当前用户角色）
   */
  static async getByUserId (userId: string): Promise<Workspace[]> {
    const sql = `
      SELECT w.*, wm.role as current_user_role
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = $1
      ORDER BY w.is_default DESC, w.created_at ASC
    `
    const result = await dbClient.query<any>(sql, [userId])
    return result.rows.map(row => this.mapRowToWorkspace(row))
  }

  /**
   * 根据 ID 获取工作区
   */
  static async getById (id: string): Promise<Workspace | null> {
    const sql = 'SELECT * FROM workspaces WHERE id = $1'
    const result = await dbClient.query<any>(sql, [id])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToWorkspace(result.rows[0])
  }

  /**
   * 根据名称获取工作区
   */
  static async getByName (name: string): Promise<Workspace | null> {
    const sql = 'SELECT * FROM workspaces WHERE name = $1'
    const result = await dbClient.query<any>(sql, [name])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToWorkspace(result.rows[0])
  }

  /**
   * 获取默认工作区
   */
  static async getDefault (): Promise<Workspace | null> {
    const sql = 'SELECT * FROM workspaces WHERE is_default = TRUE LIMIT 1'
    const result = await dbClient.query<any>(sql)

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToWorkspace(result.rows[0])
  }

  /**
   * 创建工作区
   */
  static async create (input: CreateWorkspaceInput): Promise<Workspace> {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    // 如果要设置为默认工作区,先取消其他默认工作区
    if (input.isDefault) {
      await dbClient.query('UPDATE workspaces SET is_default = FALSE WHERE is_default = TRUE')
    }

    const sql = `
      INSERT INTO workspaces (
        id, name, description, icon, color, is_default, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [
      id,
      input.name,
      input.description || null,
      input.icon || '📁',
      input.color || '#3B82F6',
      input.isDefault || false,
      now,
      now
    ])

    return this.mapRowToWorkspace(result.rows[0])
  }

  /**
   * 更新工作区
   */
  static async update (id: string, input: UpdateWorkspaceInput): Promise<Workspace | null> {
    const now = new Date().toISOString()

    // 如果要设置为默认工作区,先取消其他默认工作区
    if (input.isDefault) {
      await dbClient.query('UPDATE workspaces SET is_default = FALSE WHERE is_default = TRUE AND id != $1', [id])
    }

    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (input.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`)
      values.push(input.name)
    }

    if (input.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`)
      values.push(input.description)
    }

    if (input.icon !== undefined) {
      updateFields.push(`icon = $${paramIndex++}`)
      values.push(input.icon)
    }

    if (input.color !== undefined) {
      updateFields.push(`color = $${paramIndex++}`)
      values.push(input.color)
    }

    if (input.isDefault !== undefined) {
      updateFields.push(`is_default = $${paramIndex++}`)
      values.push(input.isDefault)
    }

    updateFields.push(`updated_at = $${paramIndex++}`)
    values.push(now)

    values.push(id)

    const sql = `
      UPDATE workspaces
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, values)

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToWorkspace(result.rows[0])
  }

  /**
   * 删除工作区
   */
  static async delete (id: string): Promise<boolean> {
    // 检查是否是默认工作区
    const workspace = await this.getById(id)
    if (workspace?.isDefault) {
      throw new Error('Cannot delete default workspace')
    }

    const sql = 'DELETE FROM workspaces WHERE id = $1'
    const result = await dbClient.query(sql, [id])
    return result.rowCount! > 0
  }

  /**
   * 设置默认工作区
   */
  static async setDefault (id: string): Promise<Workspace | null> {
    // 取消其他默认工作区
    await dbClient.query('UPDATE workspaces SET is_default = FALSE WHERE is_default = TRUE')

    // 设置新的默认工作区
    const sql = `
      UPDATE workspaces
      SET is_default = TRUE, updated_at = $1
      WHERE id = $2
      RETURNING *
    `

    const result = await dbClient.query<any>(sql, [new Date().toISOString(), id])

    if (result.rows.length === 0) {
      return null
    }

    return this.mapRowToWorkspace(result.rows[0])
  }

  /**
   * 获取工作区统计信息
   */
  static async getStats (workspaceId: string): Promise<{
    documentCount: number
    prdCount: number
  }> {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1) as document_count,
        (SELECT COUNT(*) FROM prd_documents WHERE workspace_id = $1) as prd_count
    `

    const result = await dbClient.query<any>(sql, [workspaceId])

    return {
      documentCount: parseInt(result.rows[0].document_count) || 0,
      prdCount: parseInt(result.rows[0].prd_count) || 0
    }
  }

  private static mapRowToWorkspace (row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.current_user_role ? { currentUserRole: row.current_user_role } : {})
    }
  }
}
