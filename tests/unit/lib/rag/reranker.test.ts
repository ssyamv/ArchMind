/**
 * Reranker 单元测试
 * 覆盖：computeAdaptiveWeights, rerankByRRF, rerankByScore, rerank
 */

import { describe, it, expect } from 'vitest'
import {
  computeAdaptiveWeights,
  rerankByRRF,
  rerankByScore,
  rerank
} from '~/lib/rag/reranker'
import type { RankedChunk } from '~/lib/rag/reranker'

// ─── 工厂函数 ────────────────────────────────────────────────────────────────

function makeChunk (id: string, similarity = 0.8): RankedChunk {
  return {
    id,
    documentId: `doc-${id}`,
    documentTitle: `Document ${id}`,
    content: `Content of chunk ${id}`,
    similarity
  }
}

// ─── computeAdaptiveWeights ──────────────────────────────────────────────────

describe('computeAdaptiveWeights', () => {
  it('默认权重：中等长度英文查询', () => {
    const query = 'user authentication login feature password reset'
    const { keywordWeight, vectorWeight } = computeAdaptiveWeights(query)

    expect(keywordWeight).toBeCloseTo(0.3)
    expect(vectorWeight).toBeCloseTo(0.7)
    expect(keywordWeight + vectorWeight).toBeCloseTo(1.0)
  })

  it('短查询（≤3 tokens）提升关键词权重至 0.5', () => {
    const { keywordWeight, vectorWeight } = computeAdaptiveWeights('login')

    expect(keywordWeight).toBeCloseTo(0.5)
    expect(vectorWeight).toBeCloseTo(0.5)
  })

  it('长查询（≥15 tokens）降低关键词权重至 0.2', () => {
    const longQuery = 'how to implement user authentication with JWT tokens in a Nuxt 3 application using TypeScript'
    const { keywordWeight, vectorWeight } = computeAdaptiveWeights(longQuery)

    expect(keywordWeight).toBeCloseTo(0.2)
    expect(vectorWeight).toBeCloseTo(0.8)
  })

  it('中文短查询：关键词权重提升且总和仍为 1', () => {
    const { keywordWeight, vectorWeight } = computeAdaptiveWeights('用户登录')

    // 短查询 → 0.5，中文 → +0.1 → 0.6
    expect(keywordWeight).toBeCloseTo(0.6)
    expect(vectorWeight).toBeCloseTo(0.4)
    expect(keywordWeight + vectorWeight).toBeCloseTo(1.0)
  })

  it('中文长查询：关键词权重不超过 0.6', () => {
    const longChinese = '如何在 Nuxt 3 项目中使用 TypeScript 实现基于 JWT 的用户身份认证和权限管理系统'
    const { keywordWeight, vectorWeight } = computeAdaptiveWeights(longChinese)

    expect(keywordWeight).toBeLessThanOrEqual(0.6)
    expect(keywordWeight + vectorWeight).toBeCloseTo(1.0)
  })

  it('空查询按单 token 处理（短查询规则）', () => {
    const { keywordWeight, vectorWeight } = computeAdaptiveWeights('')

    // '' 被 trim 后 split 得到 [''] → length=1 ≤ 3
    expect(keywordWeight).toBeCloseTo(0.5)
    expect(vectorWeight).toBeCloseTo(0.5)
  })

  it('两个 token 查询使用短查询权重', () => {
    const { keywordWeight } = computeAdaptiveWeights('user login')
    expect(keywordWeight).toBeCloseTo(0.5)
  })

  it('恰好 15 个 token 的查询使用长查询权重', () => {
    const query = Array(15).fill('word').join(' ')
    const { keywordWeight } = computeAdaptiveWeights(query)
    expect(keywordWeight).toBeCloseTo(0.2)
  })
})

// ─── rerankByRRF ─────────────────────────────────────────────────────────────

describe('rerankByRRF', () => {
  it('纯关键词结果（无向量结果）应按 RRF 分数降序排列', () => {
    const keyword = [makeChunk('a'), makeChunk('b'), makeChunk('c')]
    const result = rerankByRRF(keyword, [])

    // a 排在第一位（rank=0，分数最高）
    expect(result[0].id).toBe('a')
    expect(result[1].id).toBe('b')
    expect(result[2].id).toBe('c')
  })

  it('同时出现在两个列表的 chunk 应获得更高分数', () => {
    const keyword = [makeChunk('a'), makeChunk('b')]
    const vector = [makeChunk('b'), makeChunk('c')]

    const result = rerankByRRF(keyword, vector)

    // 'b' 在两个列表都出现，分数最高
    expect(result[0].id).toBe('b')
  })

  it('similarity 字段被替换为 RRF 分数', () => {
    const keyword = [makeChunk('a', 0.9)]
    const vector = [makeChunk('b', 0.95)]
    const result = rerankByRRF(keyword, vector)

    // RRF 分数为 weight/(k+rank+1)，默认 k=60
    const aScore = 0.3 / (60 + 0 + 1)
    const bScore = 0.7 / (60 + 0 + 1)
    expect(result.find(r => r.id === 'b')?.similarity).toBeCloseTo(bScore)
    expect(result.find(r => r.id === 'a')?.similarity).toBeCloseTo(aScore)
  })

  it('自定义 rrfK 值影响分数计算', () => {
    const keyword = [makeChunk('a')]
    const vector: RankedChunk[] = []

    const resultK10 = rerankByRRF(keyword, vector, { rrfK: 10, keywordWeight: 0.3, vectorWeight: 0.7 })
    const resultK60 = rerankByRRF(keyword, vector, { rrfK: 60, keywordWeight: 0.3, vectorWeight: 0.7 })

    // k=10 时分母更小，分数更高
    expect(resultK10[0].similarity).toBeGreaterThan(resultK60[0].similarity)
  })

  it('空输入返回空数组', () => {
    expect(rerankByRRF([], [])).toEqual([])
  })

  it('保留 chunk 的其他字段不变', () => {
    const chunk = makeChunk('x')
    const result = rerankByRRF([chunk], [])

    expect(result[0].documentId).toBe(chunk.documentId)
    expect(result[0].documentTitle).toBe(chunk.documentTitle)
    expect(result[0].content).toBe(chunk.content)
  })

  it('自定义权重正确分配', () => {
    const keyword = [makeChunk('a')]
    const vector = [makeChunk('b')]
    const result = rerankByRRF(keyword, vector, { keywordWeight: 0.8, vectorWeight: 0.2 })

    const aScore = result.find(r => r.id === 'a')!.similarity
    const bScore = result.find(r => r.id === 'b')!.similarity

    // keyword weight=0.8 > vector weight=0.2，a 排第一
    expect(aScore).toBeGreaterThan(bScore)
  })
})

// ─── rerankByScore ────────────────────────────────────────────────────────────

describe('rerankByScore', () => {
  it('归一化后分数最高的 chunk 排在前面', () => {
    const keyword = [
      makeChunk('a', 0.9),
      makeChunk('b', 0.5)
    ]
    const vector = [
      makeChunk('a', 0.8),
      makeChunk('c', 0.95)
    ]

    const result = rerankByScore(keyword, vector)

    // a 在两个列表都有高分，应排靠前
    const ids = result.map(r => r.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
  })

  it('仅出现在向量结果中的 chunk：关键词分数为 0', () => {
    const keyword: RankedChunk[] = []
    const vector = [makeChunk('v', 0.9)]

    const result = rerankByScore(keyword, vector)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('v')
  })

  it('空输入返回空数组', () => {
    expect(rerankByScore([], [])).toEqual([])
  })

  it('相同相似度的 chunk 不会报错', () => {
    const keyword = [makeChunk('a', 0.5), makeChunk('b', 0.5)]
    const vector = [makeChunk('a', 0.5), makeChunk('b', 0.5)]

    const result = rerankByScore(keyword, vector)
    expect(result).toHaveLength(2)
  })

  it('similarity 字段被更新为加权分数', () => {
    const keyword = [makeChunk('a', 1.0)]
    const vector = [makeChunk('a', 1.0)]

    const result = rerankByScore(keyword, vector, { keywordWeight: 0.5, vectorWeight: 0.5 })

    // 两个列表分数都归一化为 1，加权后为 0.5*1 + 0.5*1 = 1
    expect(result[0].similarity).toBeCloseTo(1.0)
  })
})

// ─── rerank（统一入口）───────────────────────────────────────────────────────

describe('rerank', () => {
  const keyword = [makeChunk('k1'), makeChunk('k2')]
  const vector = [makeChunk('v1'), makeChunk('k1')]

  it('默认策略为 RRF', () => {
    const result = rerank(keyword, vector)
    // RRF 合并后 k1 出现两次，应分数最高
    expect(result[0].id).toBe('k1')
  })

  it('指定 strategy=score 使用分数融合', () => {
    const result = rerank(keyword, vector, { strategy: 'score' })
    expect(result).toHaveLength(3) // k1, k2, v1
  })

  it('传入 query 时自动计算权重', () => {
    // 短查询 → keyword/vector 各 0.5
    const result = rerank(keyword, vector, { query: '登录' })
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })

  it('手动指定权重时不使用自动计算', () => {
    // 即使传了 query，手动指定的权重优先
    const result = rerank(keyword, vector, {
      query: '登录',
      keywordWeight: 0.9,
      vectorWeight: 0.1
    })
    // keyword 权重极高，k1 和 k2 均高于仅在 vector 列表的 v1
    const ids = result.map(r => r.id)
    const k1Rank = ids.indexOf('k1')
    const v1Rank = ids.indexOf('v1')
    // k1 同时出现在两个列表，分数 > v1
    expect(k1Rank).toBeLessThan(v1Rank)
  })

  it('空列表返回空数组', () => {
    expect(rerank([], [])).toEqual([])
  })

  it('自定义 rrfK 传递到 RRF 函数', () => {
    const result = rerank(keyword, vector, { rrfK: 1 })
    expect(result).toBeDefined()
  })
})
