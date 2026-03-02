/**
 * RAG 检索日志 DAO
 * 管理 rag_retrieval_logs 表的写入和统计查询
 */

import crypto from 'crypto'
import { dbClient } from '../client'

export interface InsertRetrievalLogInput {
  workspaceId?: string | null
  userId?: string | null
  query: string                   // 明文 query，DAO 内部 hash 后存储
  documentIds?: string[]
  similarityScores?: number[]
  strategy?: string
  threshold?: number
  resultCount?: number
}

export interface TopDocument {
  documentId: string
  documentTitle: string
  citationCount: number
  averageSimilarity: number
}

export interface ZeroCitationDocument {
  documentId: string
  documentTitle: string
}

export interface RetrievalStats {
  totalRetrievals: number
  uniqueDocumentsCited: number
  averageSimilarity: number
  hitRate: number                            // result_count > 0 的比例
  topDocuments: TopDocument[]
  zeroCitationDocuments: ZeroCitationDocument[]
}

export class RAGRetrievalLogDAO {
  /**
   * 插入检索日志（query 使用 SHA-256 hash，不存明文）
   */
  static async insert (input: InsertRetrievalLogInput): Promise<void> {
    const queryHash = crypto.createHash('sha256').update(input.query).digest('hex')
    const sql = `
      INSERT INTO rag_retrieval_logs
        (workspace_id, user_id, query_hash, document_ids, similarity_scores, strategy, threshold, result_count)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
    `
    await dbClient.query(sql, [
      input.workspaceId ?? null,
      input.userId ?? null,
      queryHash,
      input.documentIds?.length ? input.documentIds : null,
      input.similarityScores?.length ? input.similarityScores : null,
      input.strategy ?? null,
      input.threshold ?? null,
      input.resultCount ?? 0
    ])
  }

  /**
   * 获取工作区检索质量统计（最近 N 天）
   */
  static async getStats (workspaceId: string, days: number = 7): Promise<RetrievalStats> {
    // 1. 基础统计：总次数、命中率、平均相似度
    const baseSql = `
      SELECT
        COUNT(*)::int                                                        AS total_retrievals,
        COUNT(*) FILTER (WHERE result_count > 0)::int                       AS hit_count,
        AVG(
          CASE WHEN similarity_scores IS NOT NULL AND array_length(similarity_scores, 1) > 0
          THEN (SELECT AVG(v) FROM UNNEST(similarity_scores) AS v)
          ELSE NULL END
        )                                                                   AS avg_similarity
      FROM rag_retrieval_logs
      WHERE workspace_id = $1::uuid
        AND created_at >= NOW() - ($2 || ' days')::INTERVAL
    `
    const baseResult = await dbClient.query<any>(baseSql, [workspaceId, days])
    const baseRow = baseResult.rows[0]
    const totalRetrievals = Number(baseRow.total_retrievals ?? 0)
    const hitCount = Number(baseRow.hit_count ?? 0)
    const averageSimilarity = baseRow.avg_similarity != null ? Math.round(Number(baseRow.avg_similarity) * 1000) / 1000 : 0
    const hitRate = totalRetrievals > 0 ? Math.round((hitCount / totalRetrievals) * 1000) / 1000 : 0

    // 2. 被引用文档 ID 去重计数
    const uniqueDocSql = `
      SELECT COUNT(DISTINCT doc_id)::int AS unique_docs
      FROM rag_retrieval_logs,
           UNNEST(document_ids) AS doc_id
      WHERE workspace_id = $1::uuid
        AND created_at >= NOW() - ($2 || ' days')::INTERVAL
        AND document_ids IS NOT NULL
    `
    const uniqueDocResult = await dbClient.query<any>(uniqueDocSql, [workspaceId, days])
    const uniqueDocumentsCited = Number(uniqueDocResult.rows[0]?.unique_docs ?? 0)

    // 3. Top 引用文档（关联 documents 表获取标题）
    const topDocSql = `
      SELECT
        d.id             AS document_id,
        d.title          AS document_title,
        COUNT(*)::int    AS citation_count,
        AVG(avg_score)   AS avg_similarity
      FROM (
        SELECT
          doc_id,
          (SELECT AVG(v) FROM UNNEST(rl.similarity_scores) AS v) AS avg_score
        FROM rag_retrieval_logs rl,
             UNNEST(rl.document_ids) AS doc_id
        WHERE rl.workspace_id = $1::uuid
          AND rl.created_at >= NOW() - ($2 || ' days')::INTERVAL
          AND rl.document_ids IS NOT NULL
      ) sub
      JOIN documents d ON d.id = sub.doc_id
      GROUP BY d.id, d.title
      ORDER BY citation_count DESC
      LIMIT 10
    `
    const topDocResult = await dbClient.query<any>(topDocSql, [workspaceId, days])
    const topDocuments: TopDocument[] = topDocResult.rows.map((r: any) => ({
      documentId: r.document_id,
      documentTitle: r.document_title,
      citationCount: Number(r.citation_count),
      averageSimilarity: r.avg_similarity != null ? Math.round(Number(r.avg_similarity) * 1000) / 1000 : 0
    }))

    // 4. 零引用文档：属于该工作区但从未被引用
    const zeroCitationSql = `
      SELECT d.id AS document_id, d.title AS document_title
      FROM documents d
      WHERE d.workspace_id = $1
        AND d.id NOT IN (
          SELECT DISTINCT doc_id
          FROM rag_retrieval_logs,
               UNNEST(document_ids) AS doc_id
          WHERE workspace_id = $1::uuid
            AND created_at >= NOW() - ($2 || ' days')::INTERVAL
            AND document_ids IS NOT NULL
        )
      ORDER BY d.created_at DESC
      LIMIT 20
    `
    const zeroCitationResult = await dbClient.query<any>(zeroCitationSql, [workspaceId, days])
    const zeroCitationDocuments: ZeroCitationDocument[] = zeroCitationResult.rows.map((r: any) => ({
      documentId: r.document_id,
      documentTitle: r.document_title
    }))

    return {
      totalRetrievals,
      uniqueDocumentsCited,
      averageSimilarity,
      hitRate,
      topDocuments,
      zeroCitationDocuments
    }
  }
}
