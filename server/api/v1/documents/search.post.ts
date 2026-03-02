/**
 * POST /api/documents/search
 * 文档搜索 API - 支持三种模式
 *
 * 模式:
 * - keyword: 纯关键词搜索(PostgreSQL 全文检索)
 * - vector: 纯向量检索(语义相似度)
 * - hybrid: 混合搜索(RRF 融合算法) - 默认
 *
 * 缓存策略：
 * - 相同 (userId + query + mode + topK + threshold) 缓存 10 分钟
 * - 文档更新时通过 delPattern 主动失效
 */

import { RAGRetriever } from '~/lib/rag/retriever'
import { createEmbeddingAdapter } from '~/server/utils/embedding'
import { z } from 'zod'
import { cache } from '~/lib/cache'
import { CacheKeys, CacheTTL } from '~/lib/cache/keys'

const searchSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(['keyword', 'vector', 'hybrid']).optional().default('hybrid'),
  topK: z.number().int().min(1).max(50).optional().default(5),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  keywordWeight: z.number().min(0).max(1).optional().default(0.3),
  vectorWeight: z.number().min(0).max(1).optional().default(0.7)
})

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const config = useRuntimeConfig()
    const body = await readBody(event)

    // 验证输入
    const validationResult = searchSchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    const { query, mode, topK, threshold, keywordWeight, vectorWeight } = validationResult.data

    // ── 检查缓存 ──────────────────────────────────────────────────────────────
    // 以 userId 作为 workspaceId 参数（用户级隔离）
    const cacheKey = CacheKeys.ragSearch(userId, `${mode}:${query}:${topK}:${threshold}`, topK)
    const cached = await cache.get(cacheKey)
    if (cached) {
      return cached
    }

    // 初始化 embedding 适配器
    const glmApiKey = config.glmApiKey as string | undefined

    let retriever: RAGRetriever

    // 对于纯关键词搜索,不需要 embedding 适配器
    if (mode === 'keyword') {
      // 创建一个 dummy retriever (keywordSearch 方法不需要 embedding)
      retriever = new RAGRetriever(null as any, topK, threshold)
    } else {
      const embeddingAdapter = await createEmbeddingAdapter({ glmApiKey })

      if (!embeddingAdapter) {
        throw createError({
          statusCode: 500,
          message: t('errors.noEmbeddingApiKey')
        })
      }

      retriever = new RAGRetriever(embeddingAdapter, topK, threshold)
    }

    let results

    // 根据模式执行搜索
    switch (mode) {
      case 'keyword':
        // 仅关键词搜索
        results = await retriever.keywordSearch(query, topK, userId)
        break

      case 'vector':
        // 仅向量检索
        results = await retriever.retrieve(query, { topK, threshold, userId })
        break

      case 'hybrid':
      default:
        // 混合搜索(默认)
        results = await retriever.hybridSearch(query, {
          topK,
          threshold,
          keywordWeight,
          vectorWeight,
          userId
        })
        break
    }

    const response = {
      success: true,
      data: {
        query,
        mode,
        totalResults: results.length,
        parameters: {
          topK,
          threshold,
          ...(mode === 'hybrid' && { keywordWeight, vectorWeight })
        },
        results: results.map(r => ({
          id: r.id,
          documentId: r.documentId,
          documentTitle: r.documentTitle,
          contentPreview: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
          fullContent: r.content,
          similarity: r.similarity
        }))
      }
    }

    // ── 写入缓存（10 分钟）────────────────────────────────────────────────────
    await cache.set(cacheKey, response, CacheTTL.RAG_SEARCH)

    return response
  } catch (error) {
    console.error('Search error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Search failed'
    })
  }
})
