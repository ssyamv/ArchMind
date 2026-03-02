/**
 * PRD 反馈 DAO
 * 管理 prd_feedbacks 表的 CRUD 操作
 * 支持 upsert（同一用户重复提交时更新）
 */

import { dbClient } from '../client'

export interface PRDFeedback {
  id: string
  prdId: string
  userId: string
  rating: number           // 1-5
  positives: string[]      // 好的方面标签
  negatives: string[]      // 需改进标签
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateFeedbackInput {
  prdId: string
  userId: string
  rating: number           // 1-5
  positives?: string[]
  negatives?: string[]
  comment?: string
}

export interface QualityStats {
  averageRating: number
  totalFeedbacks: number
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>
  topPositives: { label: string; count: number }[]
  topNegatives: { label: string; count: number }[]
}

export class PRDFeedbackDAO {
  /**
   * upsert：同一用户重复提交时更新已有记录
   */
  static async upsert (input: CreateFeedbackInput): Promise<PRDFeedback> {
    const sql = `
      INSERT INTO prd_feedbacks (prd_id, user_id, rating, positives, negatives, comment)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (prd_id, user_id) DO UPDATE SET
        rating    = EXCLUDED.rating,
        positives = EXCLUDED.positives,
        negatives = EXCLUDED.negatives,
        comment   = EXCLUDED.comment,
        updated_at = NOW()
      RETURNING *
    `
    const result = await dbClient.query<any>(sql, [
      input.prdId,
      input.userId,
      input.rating,
      input.positives ?? null,
      input.negatives ?? null,
      input.comment ?? null
    ])
    return this.mapRow(result.rows[0])
  }

  /**
   * 查找某 PRD 下某用户的反馈（无则返回 null）
   */
  static async findByPrdAndUser (prdId: string, userId: string): Promise<PRDFeedback | null> {
    const sql = `
      SELECT * FROM prd_feedbacks
      WHERE prd_id = $1 AND user_id = $2
      LIMIT 1
    `
    const result = await dbClient.query<any>(sql, [prdId, userId])
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null
  }

  /**
   * 获取工作区 PRD 质量统计（最近 N 天）
   */
  static async getQualityStats (workspaceId: string, days: number = 30): Promise<QualityStats> {
    // 平均分、总数、评分分布
    const distSql = `
      SELECT
        f.rating,
        COUNT(*) AS cnt
      FROM prd_feedbacks f
      JOIN prd_documents pd ON pd.id = f.prd_id
      WHERE pd.workspace_id = $1
        AND f.created_at >= NOW() - ($2 || ' days')::INTERVAL
      GROUP BY f.rating
      ORDER BY f.rating
    `
    const distResult = await dbClient.query<any>(distSql, [workspaceId, days])

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let totalFeedbacks = 0
    let ratingSum = 0
    for (const row of distResult.rows) {
      const rating = Number(row.rating)
      const cnt = Number(row.cnt)
      ratingDistribution[rating] = cnt
      totalFeedbacks += cnt
      ratingSum += rating * cnt
    }
    const averageRating = totalFeedbacks > 0 ? ratingSum / totalFeedbacks : 0

    // Top positives
    const positivesSql = `
      SELECT tag, COUNT(*) AS cnt
      FROM (
        SELECT UNNEST(f.positives) AS tag
        FROM prd_feedbacks f
        JOIN prd_documents pd ON pd.id = f.prd_id
        WHERE pd.workspace_id = $1
          AND f.created_at >= NOW() - ($2 || ' days')::INTERVAL
          AND f.positives IS NOT NULL
      ) sub
      GROUP BY tag
      ORDER BY cnt DESC
      LIMIT 10
    `
    const posResult = await dbClient.query<any>(positivesSql, [workspaceId, days])
    const topPositives = posResult.rows.map((r: any) => ({ label: r.tag, count: Number(r.cnt) }))

    // Top negatives
    const negativesSql = `
      SELECT tag, COUNT(*) AS cnt
      FROM (
        SELECT UNNEST(f.negatives) AS tag
        FROM prd_feedbacks f
        JOIN prd_documents pd ON pd.id = f.prd_id
        WHERE pd.workspace_id = $1
          AND f.created_at >= NOW() - ($2 || ' days')::INTERVAL
          AND f.negatives IS NOT NULL
      ) sub
      GROUP BY tag
      ORDER BY cnt DESC
      LIMIT 10
    `
    const negResult = await dbClient.query<any>(negativesSql, [workspaceId, days])
    const topNegatives = negResult.rows.map((r: any) => ({ label: r.tag, count: Number(r.cnt) }))

    return {
      averageRating: Math.round(averageRating * 100) / 100,
      totalFeedbacks,
      ratingDistribution: ratingDistribution as Record<1 | 2 | 3 | 4 | 5, number>,
      topPositives,
      topNegatives
    }
  }

  private static mapRow (row: any): PRDFeedback {
    return {
      id: row.id,
      prdId: row.prd_id,
      userId: row.user_id,
      rating: Number(row.rating),
      positives: row.positives ?? [],
      negatives: row.negatives ?? [],
      comment: row.comment ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
