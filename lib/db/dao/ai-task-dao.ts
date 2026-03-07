/**
 * AI 任务 DAO（#69）
 */

import { randomUUID } from 'crypto'
import { dbClient } from '../client'

export type AITaskType =
  | 'prd_generate'
  | 'prototype_generate'
  | 'logic_map_generate'
  | 'document_process'
  | 'workspace_export'

export type AITaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AITask {
  id: string
  workspaceId: string
  userId: string
  type: AITaskType
  status: AITaskStatus
  progress: number
  title: string | null
  input: Record<string, unknown> | null
  outputRef: string | null
  error: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export class AITaskDAO {
  static async create (input: {
    workspaceId: string
    userId: string
    type: AITaskType
    title?: string
    input?: Record<string, unknown>
  }): Promise<AITask> {
    const id = randomUUID()
    const result = await dbClient.query<any>(
      `INSERT INTO ai_tasks (id, workspace_id, user_id, type, title, input)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, input.workspaceId, input.userId, input.type, input.title ?? null, input.input ? JSON.stringify(input.input) : null]
    )
    return this.mapRow(result.rows[0])
  }

  static async findById (id: string): Promise<AITask | null> {
    const result = await dbClient.query<any>('SELECT * FROM ai_tasks WHERE id = $1', [id])
    if (result.rows.length === 0) return null
    return this.mapRow(result.rows[0])
  }

  static async findByUser (userId: string, options?: { limit?: number; status?: AITaskStatus }): Promise<AITask[]> {
    const params: any[] = [userId]
    let sql = 'SELECT * FROM ai_tasks WHERE user_id = $1'
    if (options?.status) {
      sql += ` AND status = $${params.length + 1}`
      params.push(options.status)
    }
    sql += ' ORDER BY created_at DESC'
    sql += ` LIMIT $${params.length + 1}`
    params.push(options?.limit ?? 20)
    const result = await dbClient.query<any>(sql, params)
    return result.rows.map(r => this.mapRow(r))
  }

  /** 统计用户某类型正在运行中的任���数 */
  static async countRunning (userId: string, type: AITaskType): Promise<number> {
    const result = await dbClient.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ai_tasks
       WHERE user_id = $1 AND type = $2 AND status IN ('pending', 'running')`,
      [userId, type]
    )
    return parseInt(result.rows[0]?.count ?? '0', 10)
  }

  static async updateStatus (
    id: string,
    status: AITaskStatus,
    extra?: { progress?: number; outputRef?: string; error?: string }
  ): Promise<void> {
    const sets: string[] = ['status = $1']
    const params: any[] = [status]

    if (status === 'running') {
      sets.push(`started_at = COALESCE(started_at, NOW())`)
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      sets.push(`completed_at = NOW()`)
    }
    if (extra?.progress !== undefined) {
      sets.push(`progress = $${params.length + 1}`)
      params.push(extra.progress)
    }
    if (extra?.outputRef !== undefined) {
      sets.push(`output_ref = $${params.length + 1}`)
      params.push(extra.outputRef)
    }
    if (extra?.error !== undefined) {
      sets.push(`error = $${params.length + 1}`)
      params.push(extra.error)
    }

    params.push(id)
    await dbClient.query(
      `UPDATE ai_tasks SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    )
  }

  static async cancel (id: string, userId: string): Promise<boolean> {
    const result = await dbClient.query(
      `UPDATE ai_tasks SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'running')`,
      [id, userId]
    )
    return (result.rowCount ?? 0) > 0
  }

  private static mapRow (row: any): AITask {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      type: row.type,
      status: row.status,
      progress: row.progress ?? 0,
      title: row.title,
      input: row.input ?? null,
      outputRef: row.output_ref,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }
  }
}
