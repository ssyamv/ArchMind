/**
 * 检索质量评估指标
 *
 * 提供以下指标：
 * - MRR (Mean Reciprocal Rank)：平均倒数排名
 * - NDCG (Normalized Discounted Cumulative Gain)：归一化折损累计增益
 * - Precision@K：前 K 个结果的精确率
 * - Recall@K：前 K 个结果的召回率
 * - F1@K：精确率和召回率的调和均值
 *
 * 使用场景：
 * - 评估不同检索策略（keyword / vector / hybrid）的质量
 * - 对比 RRF 与 Score 融合策略的效果
 * - 自动化 A/B 测试
 */

export interface RetrievedItem {
  id: string
  score: number
}

export interface EvalQuery {
  /** 查询文本 */
  query: string
  /** 相关文档 ID 集合（ground truth） */
  relevantIds: string[]
}

export interface MetricsResult {
  mrr: number
  ndcg: number
  precisionAtK: number
  recallAtK: number
  f1AtK: number
  hitRate: number
}

export interface ABTestResult {
  strategyA: {
    name: string
    metrics: MetricsResult
  }
  strategyB: {
    name: string
    metrics: MetricsResult
  }
  winner: 'A' | 'B' | 'tie'
  improvement: {
    mrr: string
    ndcg: string
    f1AtK: string
  }
}

// ─── MRR ─────────────────────────────────────────────────────────────────────

/**
 * 计算单条查询的倒数排名 (Reciprocal Rank)
 *
 * RR = 1 / rank_of_first_relevant_item
 *      0 if no relevant item found
 */
export function reciprocalRank (retrieved: RetrievedItem[], relevantIds: Set<string>): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevantIds.has(retrieved[i].id)) {
      return 1 / (i + 1)
    }
  }
  return 0
}

/**
 * 计算 MRR (Mean Reciprocal Rank)
 *
 * MRR = (1 / |Q|) * Σ RR_q
 */
export function computeMRR (
  queries: EvalQuery[],
  retrievalFn: (query: string) => RetrievedItem[]
): number {
  if (queries.length === 0) return 0

  const total = queries.reduce((sum, q) => {
    const retrieved = retrievalFn(q.query)
    const relevantSet = new Set(q.relevantIds)
    return sum + reciprocalRank(retrieved, relevantSet)
  }, 0)

  return total / queries.length
}

// ─── NDCG ─────────────────────────────────────────────────────────────────────

/**
 * 计算折损累计增益 (DCG@K)
 *
 * DCG@K = Σ rel_i / log2(i + 2)   (i from 0 to K-1)
 * rel_i = 1 if item is relevant, else 0
 */
export function dcgAtK (retrieved: RetrievedItem[], relevantIds: Set<string>, k: number): number {
  const topK = retrieved.slice(0, k)
  return topK.reduce((sum, item, i) => {
    const rel = relevantIds.has(item.id) ? 1 : 0
    return sum + rel / Math.log2(i + 2)
  }, 0)
}

/**
 * 计算理想 DCG@K (IDCG)
 * 假设所有相关文档都排在最前面
 */
export function idcgAtK (relevantCount: number, k: number): number {
  const idealK = Math.min(relevantCount, k)
  let idcg = 0
  for (let i = 0; i < idealK; i++) {
    idcg += 1 / Math.log2(i + 2)
  }
  return idcg
}

/**
 * 计算 NDCG@K (Normalized Discounted Cumulative Gain)
 *
 * NDCG@K = DCG@K / IDCG@K
 */
export function ndcgAtK (retrieved: RetrievedItem[], relevantIds: Set<string>, k: number): number {
  const dcg = dcgAtK(retrieved, relevantIds, k)
  const idcg = idcgAtK(relevantIds.size, k)
  if (idcg === 0) return 0
  return dcg / idcg
}

/**
 * 计算平均 NDCG@K (Mean NDCG)
 */
export function computeNDCG (
  queries: EvalQuery[],
  retrievalFn: (query: string) => RetrievedItem[],
  k: number = 5
): number {
  if (queries.length === 0) return 0

  const total = queries.reduce((sum, q) => {
    const retrieved = retrievalFn(q.query)
    const relevantSet = new Set(q.relevantIds)
    return sum + ndcgAtK(retrieved, relevantSet, k)
  }, 0)

  return total / queries.length
}

// ─── Precision / Recall / F1 ─────────────────────────────────────────────────

/**
 * 计算 Precision@K
 *
 * P@K = |relevant ∩ retrieved[:K]| / K
 */
export function precisionAtK (retrieved: RetrievedItem[], relevantIds: Set<string>, k: number): number {
  if (k === 0) return 0
  const topK = retrieved.slice(0, k)
  const hits = topK.filter(item => relevantIds.has(item.id)).length
  return hits / k
}

/**
 * 计算 Recall@K
 *
 * R@K = |relevant ∩ retrieved[:K]| / |relevant|
 */
export function recallAtK (retrieved: RetrievedItem[], relevantIds: Set<string>, k: number): number {
  if (relevantIds.size === 0) return 0
  const topK = retrieved.slice(0, k)
  const hits = topK.filter(item => relevantIds.has(item.id)).length
  return hits / relevantIds.size
}

/**
 * 计算 F1@K
 *
 * F1@K = 2 * P@K * R@K / (P@K + R@K)
 */
export function f1AtK (retrieved: RetrievedItem[], relevantIds: Set<string>, k: number): number {
  const p = precisionAtK(retrieved, relevantIds, k)
  const r = recallAtK(retrieved, relevantIds, k)
  if (p + r === 0) return 0
  return (2 * p * r) / (p + r)
}

/**
 * 命中率 (Hit Rate@K)
 * 至少有一个相关结果出现在前 K 中
 */
export function hitRate (retrieved: RetrievedItem[], relevantIds: Set<string>, k: number): number {
  const topK = retrieved.slice(0, k)
  return topK.some(item => relevantIds.has(item.id)) ? 1 : 0
}

// ─── 综合评估 ──────────────────────────────────────────────────────────────────

/**
 * 计算单条查询的完整指标集合
 */
export function computeQueryMetrics (
  retrieved: RetrievedItem[],
  relevantIds: Set<string>,
  k: number = 5
): MetricsResult {
  return {
    mrr: reciprocalRank(retrieved, relevantIds),
    ndcg: ndcgAtK(retrieved, relevantIds, k),
    precisionAtK: precisionAtK(retrieved, relevantIds, k),
    recallAtK: recallAtK(retrieved, relevantIds, k),
    f1AtK: f1AtK(retrieved, relevantIds, k),
    hitRate: hitRate(retrieved, relevantIds, k)
  }
}

/**
 * 在一组查询上计算平均指标
 */
export function evaluateRetrieval (
  queries: EvalQuery[],
  retrievalFn: (query: string) => RetrievedItem[],
  k: number = 5
): MetricsResult {
  if (queries.length === 0) {
    return { mrr: 0, ndcg: 0, precisionAtK: 0, recallAtK: 0, f1AtK: 0, hitRate: 0 }
  }

  const accumulated = queries.reduce(
    (acc, q) => {
      const retrieved = retrievalFn(q.query)
      const relevantSet = new Set(q.relevantIds)
      const m = computeQueryMetrics(retrieved, relevantSet, k)
      return {
        mrr: acc.mrr + m.mrr,
        ndcg: acc.ndcg + m.ndcg,
        precisionAtK: acc.precisionAtK + m.precisionAtK,
        recallAtK: acc.recallAtK + m.recallAtK,
        f1AtK: acc.f1AtK + m.f1AtK,
        hitRate: acc.hitRate + m.hitRate
      }
    },
    { mrr: 0, ndcg: 0, precisionAtK: 0, recallAtK: 0, f1AtK: 0, hitRate: 0 }
  )

  const n = queries.length
  return {
    mrr: accumulated.mrr / n,
    ndcg: accumulated.ndcg / n,
    precisionAtK: accumulated.precisionAtK / n,
    recallAtK: accumulated.recallAtK / n,
    f1AtK: accumulated.f1AtK / n,
    hitRate: accumulated.hitRate / n
  }
}

// ─── A/B 对比 ─────────────────────────────────────────────────────────────────

/**
 * 对两种检索策略进行 A/B 对比测试
 *
 * @param queries - 评估查询集
 * @param strategyA - 策略 A 的检索函数和名称
 * @param strategyB - 策略 B 的检索函数和名称
 * @param k - 评估截断位置
 */
export function abTest (
  queries: EvalQuery[],
  strategyA: { name: string; fn: (query: string) => RetrievedItem[] },
  strategyB: { name: string; fn: (query: string) => RetrievedItem[] },
  k: number = 5
): ABTestResult {
  const metricsA = evaluateRetrieval(queries, strategyA.fn, k)
  const metricsB = evaluateRetrieval(queries, strategyB.fn, k)

  // 用 NDCG 作为主要对比指标
  const primaryA = metricsA.ndcg
  const primaryB = metricsB.ndcg

  let winner: 'A' | 'B' | 'tie' = 'tie'
  if (primaryA - primaryB > 0.001) winner = 'A'
  else if (primaryB - primaryA > 0.001) winner = 'B'

  const pctChange = (a: number, b: number): string => {
    if (a === 0) return b === 0 ? '0.00%' : '+∞%'
    const change = ((b - a) / a) * 100
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
  }

  return {
    strategyA: { name: strategyA.name, metrics: metricsA },
    strategyB: { name: strategyB.name, metrics: metricsB },
    winner,
    improvement: {
      mrr: pctChange(metricsA.mrr, metricsB.mrr),
      ndcg: pctChange(metricsA.ndcg, metricsB.ndcg),
      f1AtK: pctChange(metricsA.f1AtK, metricsB.f1AtK)
    }
  }
}

/**
 * 格式化指标为可读字符串
 */
export function formatMetrics (metrics: MetricsResult, k: number = 5): string {
  return [
    `MRR:          ${(metrics.mrr * 100).toFixed(2)}%`,
    `NDCG@${k}:      ${(metrics.ndcg * 100).toFixed(2)}%`,
    `Precision@${k}: ${(metrics.precisionAtK * 100).toFixed(2)}%`,
    `Recall@${k}:    ${(metrics.recallAtK * 100).toFixed(2)}%`,
    `F1@${k}:        ${(metrics.f1AtK * 100).toFixed(2)}%`,
    `HitRate@${k}:   ${(metrics.hitRate * 100).toFixed(2)}%`
  ].join('\n')
}
