/**
 * 评论 DAO
 * 管理 comments 表的 CRUD 操作
 */

import { dbClient } from '../client'

export interface Comment {
  id: string
  workspaceId: string
  targetType: 'document' | 'prd' | 'prototype'
  targetId: string
  userId: string
  username: string
  avatarUrl?: string
  content: string
  mentions: string[]
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateCommentInput {
  workspaceId: string
  targetType: 'document' | 'prd' | 'prototype'
  targetId: string
  userId: string
  content: string
  mentions?: string[]
}

export interface UpdateCommentInput {
  content?: string
  mentions?: string[]
}

export class CommentDAO {
  /**
   * 创建评论
   */
  static async create (input: CreateCommentInput): Promise<Comment> {
    const sql = `
      INSERT INTO comments (workspace_id, target_type, target_id, user_id, content, mentions)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, [
      input.workspaceId,
      input.targetType,
      input.targetId,
      input.userId,
      input.content,
      JSON.stringify(input.mentions ?? [])
    ])
    return this.mapRow(result.rows[0], true)
  }

  /**
   * 按目标资源查询评论列表（含作者信息）
   */
  static async findByTarget (
    targetType: string,
    targetId: string,
    workspaceId: string,
    options?: { includeResolved?: boolean; limit?: number; offset?: number }
  ): Promise<Comment[]> {
    const { includeResolved = true, limit = 50, offset = 0 } = options ?? {}
    const resolvedFilter = includeResolved ? '' : 'AND c.resolved = false'

    const sql = `
      SELECT
        c.*,
        u.username,
        u.avatar_url
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.workspace_id = $1
        AND c.target_type = $2
        AND c.target_id = $3
        ${resolvedFilter}
      ORDER BY c.created_at ASC
      LIMIT $4 OFFSET $5
    `
    const result = await dbClient.query<any>(sql, [workspaceId, targetType, targetId, limit, offset])
    return result.rows.map(row => this.mapRow(row))
  }

  /**
   * 按 ID 查询评论
   */
  static async findById (id: string): Promise<Comment | null> {
    const sql = `
      SELECT c.*, u.username, u.avatar_url
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
    `
    const result = await dbClient.query<any>(sql, [id])
    if (!result.rows.length) return null
    return this.mapRow(result.rows[0])
  }

  /**
   * 更新评论内容
   */
  static async update (id: string, userId: string, input: UpdateCommentInput): Promise<Comment | null> {
    const setParts: string[] = ['updated_at = NOW()']
    const params: any[] = []
    let idx = 1

    if (input.content !== undefined) {
      setParts.push(`content = $${idx++}`)
      params.push(input.content)
    }
    if (input.mentions !== undefined) {
      setParts.push(`mentions = $${idx++}`)
      params.push(JSON.stringify(input.mentions))
    }

    params.push(id, userId)
    const sql = `
      UPDATE comments
      SET ${setParts.join(', ')}
      WHERE id = $${idx++} AND user_id = $${idx}
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, params)
    if (!result.rows.length) return null
    return this.mapRow(result.rows[0], true)
  }

  /**
   * 标记评论为已解决
   */
  static async resolve (id: string, resolvedBy: string): Promise<Comment | null> {
    const sql = `
      UPDATE comments
      SET resolved = true, resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, [resolvedBy, id])
    if (!result.rows.length) return null
    return this.mapRow(result.rows[0], true)
  }

  /**
   * 删除评论（仅作者或工作区管理员可删）
   */
  static async delete (id: string): Promise<boolean> {
    const sql = 'DELETE FROM comments WHERE id = $1 RETURNING id'
    const result = await dbClient.query<any>(sql, [id])
    return result.rows.length > 0
  }

  /**
   * 查询用户被 @提及 的评论（用于通知）
   */
  static async findMentions (
    userId: string,
    workspaceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Comment[]> {
    const { limit = 20, offset = 0 } = options ?? {}
    const sql = `
      SELECT c.*, u.username, u.avatar_url
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.workspace_id = $1
        AND c.mentions @> $2::jsonb
      ORDER BY c.created_at DESC
      LIMIT $3 OFFSET $4
    `
    const result = await dbClient.query<any>(sql, [
      workspaceId,
      JSON.stringify([userId]),
      limit,
      offset
    ])
    return result.rows.map(row => this.mapRow(row))
  }

  private static mapRow (row: any, skipJoin = false): Comment {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      targetType: row.target_type as Comment['targetType'],
      targetId: row.target_id,
      userId: row.user_id,
      username: skipJoin ? '' : (row.username ?? ''),
      avatarUrl: skipJoin ? undefined : (row.avatar_url ?? undefined),
      content: row.content,
      mentions: Array.isArray(row.mentions)
        ? row.mentions
        : (typeof row.mentions === 'string' ? JSON.parse(row.mentions) : []),
      resolved: row.resolved ?? false,
      resolvedBy: row.resolved_by ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

export const commentDAO = new CommentDAO()
