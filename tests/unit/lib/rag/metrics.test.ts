/**
 * 检索质量指标单元测试
 * 覆盖：MRR, NDCG, Precision@K, Recall@K, F1@K, HitRate, A/B 对比
 */

import { describe, it, expect } from 'vitest'
import {
  reciprocalRank,
  dcgAtK,
  idcgAtK,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  f1AtK,
  hitRate,
  computeQueryMetrics,
  evaluateRetrieval,
  abTest,
  formatMetrics,
  type RetrievedItem,
  type EvalQuery
} from '~/lib/rag/metrics'

// ─── 测试数据 ─────────────────────────────────────────────────────────────────

const relevant = new Set(['a', 'b', 'c'])

const perfectResults: RetrievedItem[] = [
  { id: 'a', score: 1.0 },
  { id: 'b', score: 0.9 },
  { id: 'c', score: 0.8 }
]

const badResults: RetrievedItem[] = [
  { id: 'x', score: 0.9 },
  { id: 'y', score: 0.8 },
  { id: 'z', score: 0.7 }
]

const mixedResults: RetrievedItem[] = [
  { id: 'x', score: 0.9 },  // 不相关
  { id: 'a', score: 0.85 }, // 相关（排名 2）
  { id: 'y', score: 0.7 },  // 不相关
  { id: 'b', score: 0.6 },  // 相关（排名 4）
  { id: 'z', score: 0.5 }   // 不相关
]

// ─── reciprocalRank ───────────────────────────────────────────────────────────

describe('reciprocalRank', () => {
  it('第一个结果命中 → RR = 1', () => {
    expect(reciprocalRank(perfectResults, relevant)).toBeCloseTo(1.0)
  })

  it('第二个结果命中 → RR = 0.5', () => {
    expect(reciprocalRank(mixedResults, relevant)).toBeCloseTo(0.5)
  })

  it('没有命中 → RR = 0', () => {
    expect(reciprocalRank(badResults, relevant)).toBe(0)
  })

  it('空结果 → RR = 0', () => {
    expect(reciprocalRank([], relevant)).toBe(0)
  })

  it('空相关集合 → RR = 0', () => {
    expect(reciprocalRank(perfectResults, new Set())).toBe(0)
  })
})

// ─── DCG / IDCG / NDCG ───────────────────────────────────────────────────────

describe('dcgAtK', () => {
  it('完美检索 @3 → DCG = 1/log2(2) + 1/log2(3) + 1/log2(4)', () => {
    const expected = 1 / Math.log2(2) + 1 / Math.log2(3) + 1 / Math.log2(4)
    expect(dcgAtK(perfectResults, relevant, 3)).toBeCloseTo(expected)
  })

  it('全不相关 → DCG = 0', () => {
    expect(dcgAtK(badResults, relevant, 3)).toBe(0)
  })

  it('K=0 → DCG = 0', () => {
    expect(dcgAtK(perfectResults, relevant, 0)).toBe(0)
  })
})

describe('idcgAtK', () => {
  it('3 个相关，K=3', () => {
    const expected = 1 / Math.log2(2) + 1 / Math.log2(3) + 1 / Math.log2(4)
    expect(idcgAtK(3, 3)).toBeCloseTo(expected)
  })

  it('K > 相关数量时以相关数量为准', () => {
    expect(idcgAtK(2, 10)).toBeCloseTo(idcgAtK(2, 2))
  })

  it('0 个相关 → IDCG = 0', () => {
    expect(idcgAtK(0, 5)).toBe(0)
  })
})

describe('ndcgAtK', () => {
  it('完美检索 → NDCG = 1', () => {
    expect(ndcgAtK(perfectResults, relevant, 3)).toBeCloseTo(1.0)
  })

  it('全不相关 → NDCG = 0', () => {
    expect(ndcgAtK(badResults, relevant, 3)).toBe(0)
  })

  it('NDCG 在 [0, 1] 范围内', () => {
    const score = ndcgAtK(mixedResults, relevant, 5)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('相关集合为空 → NDCG = 0', () => {
    expect(ndcgAtK(perfectResults, new Set(), 3)).toBe(0)
  })
})

// ─── Precision / Recall / F1 ─────────────────────────────────────────────────

describe('precisionAtK', () => {
  it('完美检索 P@3 = 1', () => {
    expect(precisionAtK(perfectResults, relevant, 3)).toBeCloseTo(1.0)
  })

  it('全不相关 P@3 = 0', () => {
    expect(precisionAtK(badResults, relevant, 3)).toBe(0)
  })

  it('mixed results P@5 = 2/5', () => {
    expect(precisionAtK(mixedResults, relevant, 5)).toBeCloseTo(0.4)
  })

  it('K=0 → P = 0', () => {
    expect(precisionAtK(perfectResults, relevant, 0)).toBe(0)
  })
})

describe('recallAtK', () => {
  it('全部相关都在前 K → R = 1', () => {
    expect(recallAtK(perfectResults, relevant, 3)).toBeCloseTo(1.0)
  })

  it('全不相关 → R = 0', () => {
    expect(recallAtK(badResults, relevant, 3)).toBe(0)
  })

  it('mixed results R@5 = 2/3', () => {
    expect(recallAtK(mixedResults, relevant, 5)).toBeCloseTo(2 / 3)
  })

  it('相关集合为空 → R = 0', () => {
    expect(recallAtK(perfectResults, new Set(), 3)).toBe(0)
  })
})

describe('f1AtK', () => {
  it('P=R=1 时 F1=1', () => {
    expect(f1AtK(perfectResults, relevant, 3)).toBeCloseTo(1.0)
  })

  it('P=R=0 时 F1=0', () => {
    expect(f1AtK(badResults, relevant, 3)).toBe(0)
  })

  it('F1 是 P 和 R 的调和均值', () => {
    const k = 5
    const p = precisionAtK(mixedResults, relevant, k)
    const r = recallAtK(mixedResults, relevant, k)
    const expectedF1 = (2 * p * r) / (p + r)
    expect(f1AtK(mixedResults, relevant, k)).toBeCloseTo(expectedF1)
  })
})

describe('hitRate', () => {
  it('第一个命中 → hitRate = 1', () => {
    expect(hitRate(perfectResults, relevant, 3)).toBe(1)
  })

  it('全不相关 → hitRate = 0', () => {
    expect(hitRate(badResults, relevant, 3)).toBe(0)
  })

  it('第 K 位命中 → hitRate = 1', () => {
    // b 排在第 4 位
    expect(hitRate(mixedResults, relevant, 4)).toBe(1)
  })

  it('超出 K 才命中 → hitRate = 0', () => {
    const results: RetrievedItem[] = [
      { id: 'x', score: 1 },
      { id: 'y', score: 0.9 },
      { id: 'a', score: 0.8 } // 相关，但超出 K=2
    ]
    expect(hitRate(results, new Set(['a']), 2)).toBe(0)
  })
})

// ─── computeQueryMetrics ─────────────────────────────────────────────────────

describe('computeQueryMetrics', () => {
  it('完美检索时所有指标为 1', () => {
    const metrics = computeQueryMetrics(perfectResults, relevant, 3)
    expect(metrics.mrr).toBeCloseTo(1.0)
    expect(metrics.ndcg).toBeCloseTo(1.0)
    expect(metrics.precisionAtK).toBeCloseTo(1.0)
    expect(metrics.recallAtK).toBeCloseTo(1.0)
    expect(metrics.f1AtK).toBeCloseTo(1.0)
    expect(metrics.hitRate).toBe(1)
  })

  it('全不相关时所有指标为 0', () => {
    const metrics = computeQueryMetrics(badResults, relevant, 3)
    expect(metrics.mrr).toBe(0)
    expect(metrics.ndcg).toBe(0)
    expect(metrics.precisionAtK).toBe(0)
    expect(metrics.recallAtK).toBe(0)
    expect(metrics.f1AtK).toBe(0)
    expect(metrics.hitRate).toBe(0)
  })
})

// ─── evaluateRetrieval ────────────────────────────────────────────────────────

describe('evaluateRetrieval', () => {
  const queries: EvalQuery[] = [
    { query: 'q1', relevantIds: ['a', 'b', 'c'] },
    { query: 'q2', relevantIds: ['d', 'e'] }
  ]

  it('空查询集 → 全 0', () => {
    const metrics = evaluateRetrieval([], () => [], 5)
    expect(metrics.mrr).toBe(0)
    expect(metrics.ndcg).toBe(0)
  })

  it('平均多条查询的指标', () => {
    const retrieverFn = (query: string): RetrievedItem[] => {
      if (query === 'q1') return [{ id: 'a', score: 1 }, { id: 'x', score: 0.8 }]
      if (query === 'q2') return [{ id: 'd', score: 1 }, { id: 'e', score: 0.9 }]
      return []
    }

    const metrics = evaluateRetrieval(queries, retrieverFn, 5)

    // q1: MRR=1, q2: MRR=1 → 平均 MRR=1
    expect(metrics.mrr).toBeCloseTo(1.0)
    expect(metrics.hitRate).toBeCloseTo(1.0)
  })

  it('MRR 取平均值', () => {
    // q1: 只找到 x（不相关）→ MRR=0
    // q2: 找到 d（相关） → MRR=1
    // 平均 MRR = 0.5
    const retrieverFn = (query: string): RetrievedItem[] => {
      if (query === 'q1') return [{ id: 'x', score: 1 }]
      if (query === 'q2') return [{ id: 'd', score: 1 }]
      return []
    }

    const metrics = evaluateRetrieval(queries, retrieverFn, 5)
    expect(metrics.mrr).toBeCloseTo(0.5)
  })
})

// ─── abTest ──────────────────────────────────────────────────────────────────

describe('abTest', () => {
  const queries: EvalQuery[] = [
    { query: 'q1', relevantIds: ['a', 'b'] }
  ]

  it('策略 B 比 A 更好 → winner 为 B', () => {
    const strategyA = {
      name: 'A',
      fn: (_q: string): RetrievedItem[] => [{ id: 'x', score: 1 }] // 不相关
    }
    const strategyB = {
      name: 'B',
      fn: (_q: string): RetrievedItem[] => [{ id: 'a', score: 1 }] // 相关
    }
    const result = abTest(queries, strategyA, strategyB, 5)
    expect(result.winner).toBe('B')
  })

  it('两者相同 → winner 为 tie', () => {
    const fn = (_q: string): RetrievedItem[] => [{ id: 'a', score: 1 }, { id: 'b', score: 0.9 }]
    const result = abTest(queries, { name: 'A', fn }, { name: 'B', fn }, 5)
    expect(result.winner).toBe('tie')
  })

  it('返回改进百分比字符串', () => {
    const fnA = (_q: string): RetrievedItem[] => [{ id: 'x', score: 1 }]
    const fnB = (_q: string): RetrievedItem[] => [{ id: 'a', score: 1 }]
    const result = abTest(queries, { name: 'A', fn: fnA }, { name: 'B', fn: fnB }, 5)
    expect(result.improvement.mrr).toMatch(/^[+-]?[\d.]+%$|^\+∞%$/)
  })
})

// ─── formatMetrics ────────────────────────────────────────────────────────────

describe('formatMetrics', () => {
  it('输出包含所有指标名称', () => {
    const metrics = computeQueryMetrics(perfectResults, relevant, 5)
    const output = formatMetrics(metrics, 5)
    expect(output).toContain('MRR')
    expect(output).toContain('NDCG')
    expect(output).toContain('Precision')
    expect(output).toContain('Recall')
    expect(output).toContain('F1')
    expect(output).toContain('HitRate')
  })
})
