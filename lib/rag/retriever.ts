/**
 * RAG 检索器
 * 使用向量相似度搜索从数据库中检索相关文档
 * 支持纯向量检索、纯关键词检索和混合检索(RRF)
 */

import type { IEmbeddingAdapter } from './embedding-adapter'
import { rerank, computeAdaptiveWeights } from './reranker'
import type { RerankOptions } from './reranker'
import { VectorDAO } from '~/lib/db/dao/vector-dao'
import { DocumentChunkDAO } from '~/lib/db/dao/document-chunk-dao'
import { PrdChunkDAO } from '~/lib/db/dao/prd-chunk-dao'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { dbClient } from '~/lib/db/client'

export interface RetrievalOptions {
  topK?: number;
  threshold?: number;
  documentIds?: string[];
  prdIds?: string[];
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  similarity: number;
}

export class RAGRetriever {
  private embeddingAdapter: IEmbeddingAdapter
  private topK: number
  private threshold: number

  constructor (embeddingAdapter: IEmbeddingAdapter, topK: number = 5, threshold: number = 0.7) {
    this.embeddingAdapter = embeddingAdapter
    this.topK = topK
    this.threshold = threshold
  }

  /**
   * 根据查询文本检索相关文档块
   */
  async retrieve (query: string, options?: RetrievalOptions): Promise<RetrievedChunk[]> {
    const topK = options?.topK ?? this.topK
    const threshold = options?.threshold ?? this.threshold
    const documentIds = options?.documentIds
    const prdIds = options?.prdIds

    try {
      // 获取查询的向量表示
      const queryEmbedding = await this.embeddingAdapter.embed(query)

      // 执行向量相似度搜索（可按 documentIds / prdIds 过滤范围）
      const results = await VectorDAO.similaritySearch(queryEmbedding, topK, threshold, undefined, documentIds, prdIds)

      if (results.length === 0) {
        return []
      }

      const similarityMap = new Map(results.map(r => [r.chunkId, r.score]))
      const retrievedChunks: RetrievedChunk[] = []

      if (prdIds && prdIds.length > 0 && (!documentIds || documentIds.length === 0)) {
        // PRD 检索路径：批量获取所有相关 PRD，避免 N+1
        const chunkIds = results.map(r => r.chunkId)
        const chunks = await PrdChunkDAO.findByIds(chunkIds)

        const prdIdList = [...new Set(chunks.map(c => c.prdId))]
        const prdMap = await PRDDAO.findByIds(prdIdList)

        for (const chunk of chunks) {
          const prd = prdMap.get(chunk.prdId)
          if (prd) {
            retrievedChunks.push({
              id: chunk.id,
              documentId: chunk.prdId,
              documentTitle: `[PRD] ${prd.title}`,
              content: chunk.content,
              similarity: similarityMap.get(chunk.id) || 0
            })
          }
        }
      } else {
        // 文档检索路径：批量获取所有相关文档，避免 N+1
        const chunkIds = results.map(r => r.chunkId)
        const chunks = await DocumentChunkDAO.findByIds(chunkIds)

        const docIdList = [...new Set(chunks.map(c => c.documentId))]
        const docMap = await DocumentDAO.findByIds(docIdList)

        for (const chunk of chunks) {
          const doc = docMap.get(chunk.documentId)
          if (doc) {
            retrievedChunks.push({
              id: chunk.id,
              documentId: chunk.documentId,
              documentTitle: doc.title,
              content: chunk.content,
              similarity: similarityMap.get(chunk.id) || 0
            })
          }
        }
      }

      // 按相似度排序
      retrievedChunks.sort((a, b) => b.similarity - a.similarity)

      return retrievedChunks
    } catch (error) {
      console.error('Retrieval error:', error)
      throw error
    }
  }

  /**
   * 获取检索结果的摘要文本
   */
  summarizeResults (results: RetrievedChunk[]): string {
    return results
      .map((r, i) => `[文档 ${i + 1}: ${r.documentTitle}]\n${r.content}\n`)
      .join('\n---\n')
  }

  /**
   * 关键词搜索(PostgreSQL 全文检索)
   */
  async keywordSearch (query: string, topK: number = 10): Promise<RetrievedChunk[]> {
    try {
      const result = await dbClient.query(`
        SELECT
          dc.id,
          dc.document_id,
          d.title as document_title,
          dc.content,
          ts_rank(d.tsv, plainto_tsquery('english', $1)) as score
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE d.tsv @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $2
      `, [query, topK])

      return result.rows.map(row => ({
        id: row.id,
        documentId: row.document_id,
        documentTitle: row.document_title,
        content: row.content,
        similarity: row.score
      }))
    } catch (error) {
      console.error('Keyword search error:', error)
      throw error
    }
  }

  /**
   * 混合搜索: 结合关键词和向量检索，使用重排序模块融合结果
   *
   * 支持：
   * - 自动权重（根据查询长度和语言自动调整）
   * - RRF / Score 两种融合策略
   */
  async hybridSearch (
    query: string,
    options?: {
      topK?: number;
      threshold?: number;
      keywordWeight?: number;
      vectorWeight?: number;
      strategy?: 'rrf' | 'score';
    }
  ): Promise<RetrievedChunk[]> {
    const topK = options?.topK ?? this.topK
    const threshold = options?.threshold ?? this.threshold

    // 自动权重：若未指定，根据查询自动计算
    let { keywordWeight, vectorWeight } = options ?? {}
    if (keywordWeight === undefined || vectorWeight === undefined) {
      const adaptive = computeAdaptiveWeights(query)
      keywordWeight = keywordWeight ?? adaptive.keywordWeight
      vectorWeight = vectorWeight ?? adaptive.vectorWeight
    }

    try {
      // 1. 并行执行关键词搜索和向量检索
      const [keywordResults, vectorResults] = await Promise.all([
        this.keywordSearch(query, topK * 2),
        this.retrieve(query, { topK: topK * 2, threshold })
      ])

      // 2. 使用 reranker 融合（支持 RRF / Score 策略）
      const rerankOptions: RerankOptions = {
        keywordWeight,
        vectorWeight,
        strategy: options?.strategy ?? 'rrf',
        query
      }

      const fusedResults = rerank(keywordResults, vectorResults, rerankOptions)

      // 3. 返回 top-K 结果
      return fusedResults.slice(0, topK)
    } catch (error) {
      console.error('Hybrid search error:', error)
      throw error
    }
  }
}

