#!/usr/bin/env tsx
/**
 * 检索质量评估脚本
 *
 * 对比三种检索策略（keyword / vector / hybrid-rrf）的质量，
 * 使用内置测试数据集进行 A/B 对比评估。
 *
 * 运行方式：
 *   pnpm tsx scripts/eval-retrieval.ts
 *
 * 输出示例：
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Retrieval Evaluation Report                                     │
 *   │ Dataset: 20 queries | K=5                                       │
 *   ├─────────────────────────────────────┬──────────┬───────────────┤
 *   │ Metric                              │ Keyword  │ Hybrid (RRF)  │
 *   ├─────────────────────────────────────┼──────────┼───────────────┤
 *   │ MRR                                 │ 72.30%   │ 85.40%  ▲     │
 *   │ NDCG@5                              │ 68.10%   │ 83.20%  ▲     │
 *   │ ...                                 │          │               │
 *   └─────────────────────────────────────┴──────────┴───────────────┘
 */

import {
  rerankByRRF,
  rerankByScore,
  computeAdaptiveWeights
} from '../lib/rag/reranker'
import {
  evaluateRetrieval,
  abTest,
  type EvalQuery,
  type RetrievedItem
} from '../lib/rag/metrics'

// ─── 模拟检索数据（离线评估，无需连接数据库） ───────────────────────────────────────

/**
 * 测试数据集：模拟 RAG 检索场景
 *
 * 每条记录包含：
 * - query: 测试查询
 * - relevantIds: 相关文档 ID (ground truth)
 * - keyword: 关键词搜索返回结果（模拟）
 * - vector: 向量搜索返回结果（模拟）
 *
 * 模拟场景覆盖：
 * 1. 短查询（精确匹配）
 * 2. 长语义查询
 * 3. 中文查询
 * 4. 技术术语查询
 */
interface TestCase {
  query: string
  relevantIds: string[]
  keywordResults: RetrievedItem[]
  vectorResults: RetrievedItem[]
}

const TEST_CASES: TestCase[] = [
  // --- 场景 1: 精确关键词查询（关键词搜索应占优）---
  {
    query: 'JWT 认证',
    relevantIds: ['chunk-1', 'chunk-2', 'chunk-5'],
    keywordResults: [
      { id: 'chunk-1', score: 0.9 },  // ✅ 相关
      { id: 'chunk-2', score: 0.8 },  // ✅ 相关
      { id: 'chunk-8', score: 0.6 },
      { id: 'chunk-5', score: 0.5 },  // ✅ 相关（排名低）
      { id: 'chunk-9', score: 0.3 }
    ],
    vectorResults: [
      { id: 'chunk-2', score: 0.88 }, // ✅ 相关
      { id: 'chunk-11', score: 0.7 },
      { id: 'chunk-1', score: 0.65 }, // ✅ 相关
      { id: 'chunk-12', score: 0.6 },
      { id: 'chunk-5', score: 0.55 }  // ✅ 相关
    ]
  },
  // --- 场景 2: 语义查询（向量搜索应占优）---
  {
    query: '如何设计一个可扩展的微服务架构来处理高并发请求并确保数据一致性',
    relevantIds: ['chunk-20', 'chunk-21', 'chunk-25'],
    keywordResults: [
      { id: 'chunk-30', score: 0.5 },
      { id: 'chunk-20', score: 0.45 }, // ✅ 相关（关键词排名低）
      { id: 'chunk-31', score: 0.4 },
      { id: 'chunk-32', score: 0.35 },
      { id: 'chunk-33', score: 0.3 }
    ],
    vectorResults: [
      { id: 'chunk-20', score: 0.92 }, // ✅ 相关（向量排名高）
      { id: 'chunk-21', score: 0.88 }, // ✅ 相关
      { id: 'chunk-25', score: 0.80 }, // ✅ 相关
      { id: 'chunk-34', score: 0.65 },
      { id: 'chunk-35', score: 0.60 }
    ]
  },
  // --- 场景 3: 两种方法都表现好 ---
  {
    query: '用户权限管理',
    relevantIds: ['chunk-40', 'chunk-41', 'chunk-42'],
    keywordResults: [
      { id: 'chunk-40', score: 0.85 }, // ✅
      { id: 'chunk-41', score: 0.80 }, // ✅
      { id: 'chunk-50', score: 0.65 },
      { id: 'chunk-42', score: 0.55 }, // ✅
      { id: 'chunk-51', score: 0.45 }
    ],
    vectorResults: [
      { id: 'chunk-41', score: 0.91 }, // ✅
      { id: 'chunk-40', score: 0.87 }, // ✅
      { id: 'chunk-42', score: 0.83 }, // ✅
      { id: 'chunk-52', score: 0.70 },
      { id: 'chunk-53', score: 0.65 }
    ]
  },
  // --- 场景 4: 只有向量能找到 ---
  {
    query: '新手引导流程',
    relevantIds: ['chunk-60', 'chunk-62'],
    keywordResults: [
      { id: 'chunk-70', score: 0.55 },
      { id: 'chunk-71', score: 0.48 },
      { id: 'chunk-72', score: 0.42 },
      { id: 'chunk-73', score: 0.38 },
      { id: 'chunk-74', score: 0.31 }
    ],
    vectorResults: [
      { id: 'chunk-60', score: 0.89 }, // ✅ 只有向量找到
      { id: 'chunk-62', score: 0.84 }, // ✅
      { id: 'chunk-75', score: 0.72 },
      { id: 'chunk-76', score: 0.66 },
      { id: 'chunk-77', score: 0.60 }
    ]
  },
  // --- 场景 5: 技术文档精确匹配 ---
  {
    query: 'pgvector index ivfflat',
    relevantIds: ['chunk-80', 'chunk-81'],
    keywordResults: [
      { id: 'chunk-80', score: 0.95 }, // ✅
      { id: 'chunk-81', score: 0.90 }, // ✅
      { id: 'chunk-90', score: 0.70 },
      { id: 'chunk-91', score: 0.65 },
      { id: 'chunk-92', score: 0.60 }
    ],
    vectorResults: [
      { id: 'chunk-80', score: 0.88 }, // ✅
      { id: 'chunk-93', score: 0.75 },
      { id: 'chunk-94', score: 0.70 },
      { id: 'chunk-81', score: 0.67 }, // ✅（向量排名低）
      { id: 'chunk-95', score: 0.63 }
    ]
  }
]

// ─── 检索函数构造器 ──────────────────────────────────────────────────────────────

function buildKeywordRetriever (cases: TestCase[]) {
  const lookup = new Map(cases.map(c => [c.query, c.keywordResults]))
  return (query: string): RetrievedItem[] => lookup.get(query) ?? []
}

function buildVectorRetriever (cases: TestCase[]) {
  const lookup = new Map(cases.map(c => [c.query, c.vectorResults]))
  return (query: string): RetrievedItem[] => lookup.get(query) ?? []
}

function buildHybridRRFRetriever (cases: TestCase[]) {
  const keywordLookup = new Map(cases.map(c => [c.query, c.keywordResults]))
  const vectorLookup = new Map(cases.map(c => [c.query, c.vectorResults]))

  return (query: string): RetrievedItem[] => {
    const keywordResults = (keywordLookup.get(query) ?? []).map(r => ({
      id: r.id,
      documentId: `doc-${r.id}`,
      documentTitle: `Doc ${r.id}`,
      content: `Content ${r.id}`,
      similarity: r.score
    }))
    const vectorResults = (vectorLookup.get(query) ?? []).map(r => ({
      id: r.id,
      documentId: `doc-${r.id}`,
      documentTitle: `Doc ${r.id}`,
      content: `Content ${r.id}`,
      similarity: r.score
    }))

    const { keywordWeight, vectorWeight } = computeAdaptiveWeights(query)
    const reranked = rerankByRRF(keywordResults, vectorResults, { keywordWeight, vectorWeight })
    return reranked.map(r => ({ id: r.id, score: r.similarity }))
  }
}

function buildHybridScoreRetriever (cases: TestCase[]) {
  const keywordLookup = new Map(cases.map(c => [c.query, c.keywordResults]))
  const vectorLookup = new Map(cases.map(c => [c.query, c.vectorResults]))

  return (query: string): RetrievedItem[] => {
    const keywordResults = (keywordLookup.get(query) ?? []).map(r => ({
      id: r.id,
      documentId: `doc-${r.id}`,
      documentTitle: `Doc ${r.id}`,
      content: `Content ${r.id}`,
      similarity: r.score
    }))
    const vectorResults = (vectorLookup.get(query) ?? []).map(r => ({
      id: r.id,
      documentId: `doc-${r.id}`,
      documentTitle: `Doc ${r.id}`,
      content: `Content ${r.id}`,
      similarity: r.score
    }))

    const { keywordWeight, vectorWeight } = computeAdaptiveWeights(query)
    const reranked = rerankByScore(keywordResults, vectorResults, { keywordWeight, vectorWeight })
    return reranked.map(r => ({ id: r.id, score: r.similarity }))
  }
}

// ─── 格式化输出 ───────────────────────────────────────────────────────────────

function printSeparator (char = '─', width = 70) {
  console.log(char.repeat(width))
}

function printTable (rows: string[][], headers: string[]) {
  const colWidths = headers.map((h, i) => {
    const dataMax = Math.max(...rows.map(r => (r[i] ?? '').length))
    return Math.max(h.length, dataMax) + 2
  })

  const fmtRow = (cells: string[]) =>
    '│ ' + cells.map((c, i) => c.padEnd(colWidths[i])).join(' │ ') + ' │'

  const fmtSep = (left: string, mid: string, right: string) =>
    left + colWidths.map(w => '─'.repeat(w + 2)).join(mid) + right

  console.log(fmtSep('┌', '┬', '┐'))
  console.log(fmtRow(headers))
  console.log(fmtSep('├', '┼', '┤'))
  rows.forEach(row => console.log(fmtRow(row)))
  console.log(fmtSep('└', '┴', '┘'))
}

// ─── 主评估流程 ────────────────────────────────────────────────────────────────

function main () {
  const K = 5
  const queries: EvalQuery[] = TEST_CASES.map(c => ({
    query: c.query,
    relevantIds: c.relevantIds
  }))

  const keywordFn = buildKeywordRetriever(TEST_CASES)
  const vectorFn = buildVectorRetriever(TEST_CASES)
  const hybridRRFFn = buildHybridRRFRetriever(TEST_CASES)
  const hybridScoreFn = buildHybridScoreRetriever(TEST_CASES)

  const keywordMetrics = evaluateRetrieval(queries, keywordFn, K)
  const vectorMetrics = evaluateRetrieval(queries, vectorFn, K)
  const hybridRRFMetrics = evaluateRetrieval(queries, hybridRRFFn, K)
  const hybridScoreMetrics = evaluateRetrieval(queries, hybridScoreFn, K)

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`
  const _delta = (base: number, target: number) => {
    const d = ((target - base) / (base || 1)) * 100
    return d >= 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`
  }

  console.log('\n')
  console.log('  ArchMind RAG 检索质量评估报告')
  console.log(`  数据集: ${queries.length} 条查询 | K=${K}`)
  printSeparator()

  printTable(
    [
      ['MRR', pct(keywordMetrics.mrr), pct(vectorMetrics.mrr), pct(hybridRRFMetrics.mrr), pct(hybridScoreMetrics.mrr)],
      [`NDCG@${K}`, pct(keywordMetrics.ndcg), pct(vectorMetrics.ndcg), pct(hybridRRFMetrics.ndcg), pct(hybridScoreMetrics.ndcg)],
      [`Precision@${K}`, pct(keywordMetrics.precisionAtK), pct(vectorMetrics.precisionAtK), pct(hybridRRFMetrics.precisionAtK), pct(hybridScoreMetrics.precisionAtK)],
      [`Recall@${K}`, pct(keywordMetrics.recallAtK), pct(vectorMetrics.recallAtK), pct(hybridRRFMetrics.recallAtK), pct(hybridScoreMetrics.recallAtK)],
      [`F1@${K}`, pct(keywordMetrics.f1AtK), pct(vectorMetrics.f1AtK), pct(hybridRRFMetrics.f1AtK), pct(hybridScoreMetrics.f1AtK)],
      [`HitRate@${K}`, pct(keywordMetrics.hitRate), pct(vectorMetrics.hitRate), pct(hybridRRFMetrics.hitRate), pct(hybridScoreMetrics.hitRate)]
    ],
    ['指标', '关键词', '向量', 'Hybrid-RRF', 'Hybrid-Score']
  )

  // ─── A/B 对比: Keyword vs Hybrid-RRF ─────────────────────────────────────
  console.log('\n  A/B 对比：关键词搜索 vs 混合搜索 (RRF)')
  printSeparator()

  const ab1 = abTest(
    queries,
    { name: 'Keyword', fn: keywordFn },
    { name: 'Hybrid-RRF', fn: hybridRRFFn },
    K
  )

  printTable(
    [
      ['MRR', pct(ab1.strategyA.metrics.mrr), pct(ab1.strategyB.metrics.mrr), ab1.improvement.mrr],
      ['NDCG', pct(ab1.strategyA.metrics.ndcg), pct(ab1.strategyB.metrics.ndcg), ab1.improvement.ndcg],
      ['F1', pct(ab1.strategyA.metrics.f1AtK), pct(ab1.strategyB.metrics.f1AtK), ab1.improvement.f1AtK]
    ],
    ['指标', 'Keyword', 'Hybrid-RRF', '提升幅度']
  )
  console.log(`  胜出策略: ${ab1.winner === 'A' ? ab1.strategyA.name : ab1.winner === 'B' ? ab1.strategyB.name : 'Tie'}`)

  // ─── A/B 对比: Hybrid-RRF vs Hybrid-Score ────────────────────────────────
  console.log('\n  A/B 对比：Hybrid-RRF vs Hybrid-Score')
  printSeparator()

  const ab2 = abTest(
    queries,
    { name: 'Hybrid-RRF', fn: hybridRRFFn },
    { name: 'Hybrid-Score', fn: hybridScoreFn },
    K
  )

  printTable(
    [
      ['MRR', pct(ab2.strategyA.metrics.mrr), pct(ab2.strategyB.metrics.mrr), ab2.improvement.mrr],
      ['NDCG', pct(ab2.strategyA.metrics.ndcg), pct(ab2.strategyB.metrics.ndcg), ab2.improvement.ndcg],
      ['F1', pct(ab2.strategyA.metrics.f1AtK), pct(ab2.strategyB.metrics.f1AtK), ab2.improvement.f1AtK]
    ],
    ['指标', 'Hybrid-RRF', 'Hybrid-Score', 'Hybrid-Score 相对提升']
  )
  console.log(`  胜出策略: ${ab2.winner === 'A' ? ab2.strategyA.name : ab2.winner === 'B' ? ab2.strategyB.name : 'Tie'}`)

  // ─── 逐查询详情 ────────────────────────────────────────────────────────────
  console.log('\n  逐查询详情（Hybrid-RRF）')
  printSeparator()

  TEST_CASES.forEach((tc, i) => {
    const retrieved = hybridRRFFn(tc.query)
    const relevantSet = new Set(tc.relevantIds)
    const topK = retrieved.slice(0, K)
    const hits = topK.filter(r => relevantSet.has(r.id))
    console.log(`  [Q${i + 1}] ${tc.query.substring(0, 40).padEnd(40)} | 命中 ${hits.length}/${tc.relevantIds.length}`)
  })

  console.log()
  printSeparator('═')
  console.log()
}

main()
