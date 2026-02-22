/**
 * 混合搜索重排序模块
 *
 * 提供两种重排序策略：
 * 1. RRF (Reciprocal Rank Fusion) - 倒数排名融合，无需额外模型
 * 2. Score-based - 基于相似度分数的线性加权融合
 *
 * 权重动态调整规则：
 * - 短查询（< 5 tokens）：提高关键词权重，降低向量权重
 * - 长查询（> 20 tokens）：提高向量权重，关键词权重降低
 * - 中文内容：稍微提高关键词权重（全文检索在中文上有优势）
 * - 默认：向量 0.7，关键词 0.3
 */

export interface RankedChunk {
  id: string
  documentId: string
  documentTitle: string
  content: string
  similarity: number
}

export interface RerankOptions {
  keywordWeight?: number
  vectorWeight?: number
  rrfK?: number                     // RRF 常数，通常为 60
  strategy?: 'rrf' | 'score'       // 融合策略
  query?: string                    // 传入 query 用于自动调整权重
}

/**
 * 根据查询文本自动计算最优权重
 */
export function computeAdaptiveWeights (query: string): { keywordWeight: number; vectorWeight: number } {
  const tokenCount = query.trim().split(/\s+/).length
  const hasChineseChars = /[\u4e00-\u9fff]/.test(query)

  let keywordWeight = 0.3
  let vectorWeight = 0.7

  // 短查询：关键词匹配更精准
  if (tokenCount <= 3) {
    keywordWeight = 0.5
    vectorWeight = 0.5
  } else if (tokenCount >= 15) {
    // 长查询：语义相似度更可靠
    keywordWeight = 0.2
    vectorWeight = 0.8
  }

  // 中文查询：适度提升关键词权重
  if (hasChineseChars) {
    keywordWeight = Math.min(keywordWeight + 0.1, 0.6)
    vectorWeight = 1 - keywordWeight
  }

  return { keywordWeight, vectorWeight }
}

/**
 * RRF 倒数排名融合
 *
 * score(d) = Σ [ w_i / (k + rank_i(d)) ]
 */
export function rerankByRRF (
  keywordResults: RankedChunk[],
  vectorResults: RankedChunk[],
  options?: Pick<RerankOptions, 'keywordWeight' | 'vectorWeight' | 'rrfK'>
): RankedChunk[] {
  const k = options?.rrfK ?? 60
  const keywordWeight = options?.keywordWeight ?? 0.3
  const vectorWeight = options?.vectorWeight ?? 0.7

  const scores = new Map<string, { chunk: RankedChunk; score: number }>()

  keywordResults.forEach((chunk, rank) => {
    const rrfScore = keywordWeight / (k + rank + 1)
    scores.set(chunk.id, { chunk, score: rrfScore })
  })

  vectorResults.forEach((chunk, rank) => {
    const rrfScore = vectorWeight / (k + rank + 1)
    const existing = scores.get(chunk.id)
    if (existing) {
      existing.score += rrfScore
    } else {
      scores.set(chunk.id, { chunk, score: rrfScore })
    }
  })

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(item => ({ ...item.chunk, similarity: item.score }))
}

/**
 * 基于分数的线性加权融合
 *
 * score(d) = w_keyword * norm_keyword_score + w_vector * norm_vector_score
 */
export function rerankByScore (
  keywordResults: RankedChunk[],
  vectorResults: RankedChunk[],
  options?: Pick<RerankOptions, 'keywordWeight' | 'vectorWeight'>
): RankedChunk[] {
  const keywordWeight = options?.keywordWeight ?? 0.3
  const vectorWeight = options?.vectorWeight ?? 0.7

  // 归一化分数
  const normalize = (chunks: RankedChunk[]): Map<string, number> => {
    const scores = chunks.map(c => c.similarity)
    const max = Math.max(...scores, 1e-9)
    const min = Math.min(...scores, 0)
    const range = max - min || 1
    return new Map(chunks.map(c => [c.id, (c.similarity - min) / range]))
  }

  const keywordNorm = normalize(keywordResults)
  const vectorNorm = normalize(vectorResults)

  const allIds = new Set([
    ...keywordResults.map(c => c.id),
    ...vectorResults.map(c => c.id)
  ])

  const chunkMap = new Map<string, RankedChunk>([
    ...keywordResults.map(c => [c.id, c] as [string, RankedChunk]),
    ...vectorResults.map(c => [c.id, c] as [string, RankedChunk])
  ])

  const fused: Array<{ chunk: RankedChunk; score: number }> = []

  for (const id of allIds) {
    const chunk = chunkMap.get(id)!
    const kScore = keywordNorm.get(id) ?? 0
    const vScore = vectorNorm.get(id) ?? 0
    const score = keywordWeight * kScore + vectorWeight * vScore
    fused.push({ chunk, score })
  }

  return fused
    .sort((a, b) => b.score - a.score)
    .map(item => ({ ...item.chunk, similarity: item.score }))
}

/**
 * 统一重排序入口
 */
export function rerank (
  keywordResults: RankedChunk[],
  vectorResults: RankedChunk[],
  options?: RerankOptions
): RankedChunk[] {
  let { keywordWeight, vectorWeight } = options ?? {}

  // 自动权重
  if (options?.query && keywordWeight === undefined && vectorWeight === undefined) {
    const adaptive = computeAdaptiveWeights(options.query)
    keywordWeight = adaptive.keywordWeight
    vectorWeight = adaptive.vectorWeight
  }

  const strategy = options?.strategy ?? 'rrf'

  if (strategy === 'score') {
    return rerankByScore(keywordResults, vectorResults, { keywordWeight, vectorWeight })
  }

  return rerankByRRF(keywordResults, vectorResults, {
    keywordWeight,
    vectorWeight,
    rrfK: options?.rrfK
  })
}
