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
import { RAGRetrievalLogDAO } from '~/lib/db/dao/rag-retrieval-log-dao'

export interface RetrievalOptions {
  topK?: number;
  threshold?: number;
  documentIds?: string[];
  prdIds?: string[];
  userId?: string;
  /** 工作区 ID，供检索日志写入使用（#59）及阈值偏移计算 */
  workspaceId?: string;
  /** 检索策略：'hybrid'（默认）使用 RRF 混合搜索，'vector' 仅向量检索 */
  ragStrategy?: 'hybrid' | 'vector';
  /** 明确覆盖动态阈值，优先级高于 threshold 和动态计算 */
  thresholdOverride?: number;
  /** 工作区级阈值偏移量（-0.1 ~ +0.1），叠加在动态基准阈值上 */
  workspaceThresholdOffset?: number;
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
   * 动态阈值计算
   * 根据查询长度、语言特征自动调整相似度阈值
   * @param query 查询文本
   * @param baseOffset 工作区级偏移量（默认 0）
   * @returns 限制在 [0.55, 0.85] 之间的阈值
   */
  static computeThreshold (query: string, baseOffset: number = 0): number {
    const tokenCount = query.length / 4  // 粗估 token 数

    let threshold = 0.70 + baseOffset    // 基准阈值 + 工作区级偏移

    if (tokenCount < 5) threshold -= 0.05    // 短查询：放宽阈值
    if (tokenCount > 20) threshold += 0.05   // 长查询：收紧阈值
    if (/\b[A-Z]{2,}\b/.test(query)) threshold += 0.03   // 含缩写词：精确匹配
    if (/^[\u4e00-\u9fa5\s]+$/.test(query) && tokenCount < 10) threshold -= 0.03  // 纯中文短句：放宽

    return Math.min(Math.max(threshold, 0.55), 0.85)  // 限制在 [0.55, 0.85]
  }

  /**
   * 根据查询文本检索相关文档块
   * 默认使用混合搜索（RRF），可通过 ragStrategy: 'vector' 退回纯向量检索
   * prdIds 专用路径（跨不同数据表）暂不支持混合搜索，继续走纯向量
   *
   * 阈值优先级：thresholdOverride > threshold > 动态计算
   */
  async retrieve (query: string, options?: RetrievalOptions): Promise<RetrievedChunk[]> {
    // 动态阈值决策
    const effectiveThreshold = options?.thresholdOverride
      ?? options?.threshold
      ?? RAGRetriever.computeThreshold(query, options?.workspaceThresholdOffset ?? 0)

    console.debug(`[RAG] query="${query.slice(0, 30)}" threshold=${effectiveThreshold}`)

    const strategy = options?.ragStrategy ?? 'hybrid'
    const hasPrdScope = options?.prdIds && options.prdIds.length > 0

    let results: RetrievedChunk[]
    if (strategy === 'hybrid' && !hasPrdScope) {
      results = await this.hybridSearch(query, {
        topK: options?.topK,
        threshold: effectiveThreshold,
        documentIds: options?.documentIds,
        userId: options?.userId
      })
    } else {
      results = await this._vectorRetrieve(query, options)
    }

    // 异步写检索日志（fire-and-forget，错误不影响主流程）
    setImmediate(async () => {
      try {
        await RAGRetrievalLogDAO.insert({
          workspaceId: options?.workspaceId ?? null,
          userId: options?.userId ?? null,
          query,
          documentIds: results.map(r => r.documentId),
          similarityScores: results.map(r => r.similarity),
          strategy: strategy === 'hybrid' && !hasPrdScope ? 'hybrid' : 'vector',
          threshold: options?.threshold ?? this.threshold,
          resultCount: results.length
        })
      } catch (e) {
        console.warn('[RAG] 日志写入失败（不影响检索结果）', e)
      }
    })

    return results
  }

  /**
   * 纯向量检索（内部实现，供 retrieve() 和 hybridSearch() 调用）
   */
  private async _vectorRetrieve (query: string, options?: RetrievalOptions): Promise<RetrievedChunk[]> {
    const topK = options?.topK ?? this.topK
    const threshold = options?.threshold ?? this.threshold
    const documentIds = options?.documentIds
    const prdIds = options?.prdIds
    const userId = options?.userId

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
            // userId 过滤：只返回属于当前用户或无归属（历史数据）的文档
            if (userId && doc.userId && doc.userId !== userId) {
              continue
            }
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
   * 关键词搜索（PostgreSQL 全文检索）
   * 自动检测查询语言，中文查询使用 simple 配置（逐字匹配），英文使用 english
   * 支持按 documentIds 过滤范围
   */
  async keywordSearch (
    query: string,
    topK: number = 10,
    userId?: string,
    documentIds?: string[]
  ): Promise<RetrievedChunk[]> {
    // 自动检测查询语言：中文用 simple（逐字索引），英文用 english（词干化）
    // 字面量联合类型限定只能是这两个值，防止 SQL 拼接引入不可信内容
    type TsConfig = 'simple' | 'english'
    const hasChineseChars = /[\u4e00-\u9fff]/.test(query)
    const tsConfig: TsConfig = hasChineseChars ? 'simple' : 'english'

    try {
      let sql = `
        SELECT
          dc.id,
          dc.document_id,
          d.title as document_title,
          dc.content,
          ts_rank(d.tsv, plainto_tsquery('${tsConfig}', $1)) as score
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE d.tsv @@ plainto_tsquery('${tsConfig}', $1)
      `
      const params: unknown[] = [query]

      if (userId) {
        sql += ` AND (d.user_id = $${params.length + 1} OR d.user_id IS NULL)`
        params.push(userId)
      }

      if (documentIds && documentIds.length > 0) {
        sql += ` AND d.id = ANY($${params.length + 1}::uuid[])`
        params.push(documentIds)
      }

      sql += ` ORDER BY score DESC LIMIT $${params.length + 1}`
      params.push(topK)

      const result = await dbClient.query(sql, params)

      return result.rows.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        documentId: String(row.document_id),
        documentTitle: String(row.document_title),
        content: String(row.content),
        similarity: Number(row.score)
      }))
    } catch (error) {
      console.error('Keyword search error:', error)
      throw error
    }
  }

  /**
   * 混合搜索：结合关键词和向量检索，使用重排序模块融合结果
   *
   * 支持：
   * - 自动权重（根据查询长度和语言自动调整）
   * - RRF / Score 两种融合策略
   * - documentIds 范围过滤
   */
  async hybridSearch (
    query: string,
    options?: {
      topK?: number;
      threshold?: number;
      keywordWeight?: number;
      vectorWeight?: number;
      strategy?: 'rrf' | 'score';
      userId?: string;
      documentIds?: string[];
    }
  ): Promise<RetrievedChunk[]> {
    const topK = options?.topK ?? this.topK
    const threshold = options?.threshold ?? this.threshold
    const userId = options?.userId
    const documentIds = options?.documentIds

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
        this.keywordSearch(query, topK * 2, userId, documentIds),
        this._vectorRetrieve(query, { topK: topK * 2, threshold, userId, documentIds })
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
