/**
 * PRD 质量评估维度扩展测试（#53）
 * 测试 PRDQualityCheck 接口新增字段、加权平均计算和质量阈值默认值
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock 所有 AI 依赖
vi.mock('~/lib/ai/manager', () => ({
  ModelManager: vi.fn().mockImplementation(function (this: any) {
    this.getAdapter = vi.fn().mockReturnValue({
      generateText: vi.fn().mockResolvedValue(JSON.stringify({
        completeness: 0.80,
        specificity: 0.75,
        logicalConsistency: 0.70,
        kpiQuality: 0.65,
        feasibility: 0.72,
        userFocus: 0.78,
        averageScore: 0.75,
        issues: [
          { section: '核心功能', issue: '测试问题', severity: 'warning', suggestion: '建议' },
          { section: '成功指标', issue: '指标不清晰', severity: 'error', suggestion: '量化' },
          { section: '用户流程', issue: '流程不完整', severity: 'suggestion', suggestion: '补充流程图' }
        ]
      }))
    })
    this.estimateCost = () => null
    this.getAvailableModels = () => []
  })
}))

vi.mock('~/lib/rag/retriever', () => ({
  RAGRetriever: vi.fn().mockImplementation(function (this: any) {
    this.retrieve = async () => []
    this.summarizeResults = () => ''
  })
}))

vi.mock('~/lib/ai/prompts/prd-examples', () => ({
  selectRelevantExamples: () => []
}))

vi.mock('~/lib/ai/prompts/prd-system', () => ({
  buildPRDPrompt: () => 'mock prompt',
  PRD_SYSTEM_PROMPT: 'mock system prompt'
}))

import { PRDRefinementEngine } from '~/lib/prd/refinement-engine'
import type { PRDQualityCheck } from '~/lib/prd/refinement-engine'

describe('PRDQualityCheck 接口 - 6 维度字段', () => {
  it('质量检查结果包含所有 6 个评分字段', () => {
    const check: PRDQualityCheck = {
      completeness: 0.8,
      specificity: 0.75,
      logicalConsistency: 0.7,
      kpiQuality: 0.65,
      feasibility: 0.72,
      userFocus: 0.78,
      averageScore: 0.75,
      issues: []
    }

    expect(check.completeness).toBeDefined()
    expect(check.specificity).toBeDefined()
    expect(check.logicalConsistency).toBeDefined()
    expect(check.kpiQuality).toBeDefined()
    expect(check.feasibility).toBeDefined()
    expect(check.userFocus).toBeDefined()
    expect(check.averageScore).toBeDefined()
  })

  it('6 个维度权重之和为 1.0', () => {
    const weights = {
      completeness: 0.25,
      specificity: 0.20,
      logicalConsistency: 0.15,
      kpiQuality: 0.10,
      feasibility: 0.15,
      userFocus: 0.15
    }
    const sum = Object.values(weights).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 10)
  })

  it('加权平均计算公式正确（手动验证）', () => {
    const scores = {
      completeness: 0.80,
      specificity: 0.75,
      logicalConsistency: 0.70,
      kpiQuality: 0.65,
      feasibility: 0.72,
      userFocus: 0.78
    }
    const expected =
      scores.completeness * 0.25 +
      scores.specificity * 0.20 +
      scores.logicalConsistency * 0.15 +
      scores.kpiQuality * 0.10 +
      scores.feasibility * 0.15 +
      scores.userFocus * 0.15

    expect(expected).toBeCloseTo(0.745, 3)
  })
})

describe('PRDRefinementEngine.evaluateQuality() - 新维度解析', () => {
  let engine: PRDRefinementEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new PRDRefinementEngine()
  })

  it('解析含 feasibility 和 userFocus 的 AI 输出', async () => {
    const result = await engine.evaluateQuality('Sample PRD content')

    expect(result).toHaveProperty('feasibility')
    expect(result).toHaveProperty('userFocus')
    expect(typeof result.feasibility).toBe('number')
    expect(typeof result.userFocus).toBe('number')
    expect(result.feasibility).toBeGreaterThanOrEqual(0)
    expect(result.feasibility).toBeLessThanOrEqual(1)
  })

  it('issues 数组不为空', async () => {
    const result = await engine.evaluateQuality('Sample PRD')
    expect(Array.isArray(result.issues)).toBe(true)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('averageScore 在 [0, 1] 范围内', async () => {
    const result = await engine.evaluateQuality('Sample PRD')
    expect(result.averageScore).toBeGreaterThanOrEqual(0)
    expect(result.averageScore).toBeLessThanOrEqual(1)
  })
})

describe('PRDRefinementEngine.evaluateQuality() - 字段缺失时的兜底行为', () => {
  it('AI 输出缺少 feasibility/userFocus 时抛出错误并返回默认值', async () => {
    // mock 返回不含 feasibility 和 userFocus 的 JSON
    const { ModelManager } = await import('~/lib/ai/manager')
    vi.mocked(ModelManager).mockImplementationOnce(function (this: any) {
      this.getAdapter = () => ({
        generateText: async () => JSON.stringify({
          completeness: 0.8,
          specificity: 0.7,
          logicalConsistency: 0.6,
          kpiQuality: 0.5,
          // 故意缺少 feasibility 和 userFocus
          averageScore: 0.65,
          issues: []
        })
      })
      this.estimateCost = () => null
      this.getAvailableModels = () => []
    })

    const engineBad = new PRDRefinementEngine()
    const result = await engineBad.evaluateQuality('Sample PRD')

    // 返回兜底值 0.5
    expect(result.feasibility).toBe(0.5)
    expect(result.userFocus).toBe(0.5)
    expect(result.averageScore).toBe(0.5)
  })

  it('AI 返回无效 JSON 时返回默认值', async () => {
    const { ModelManager } = await import('~/lib/ai/manager')
    vi.mocked(ModelManager).mockImplementationOnce(function (this: any) {
      this.getAdapter = () => ({
        generateText: async () => 'not valid json'
      })
      this.estimateCost = () => null
      this.getAvailableModels = () => []
    })

    const engineBad = new PRDRefinementEngine()
    const result = await engineBad.evaluateQuality('Sample PRD')

    expect(result.completeness).toBe(0.5)
    expect(result.feasibility).toBe(0.5)
    expect(result.userFocus).toBe(0.5)
    expect(result.averageScore).toBe(0.5)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].section).toBe('评估失败')
  })
})

describe('RefinementOptions - 默认质量阈值', () => {
  it('默认质量阈值已下调至 0.80', async () => {
    // 通过测试 generateWithRefinement 的行为来验证阈值
    // mock 返回的 averageScore 为 0.82（在新阈值 0.80 以上，但在旧阈值 0.85 以下）
    // 如果阈值为 0.80，则 0.82 >= 0.80，应该在 iteration=0 时就提前退出
    const { ModelManager } = await import('~/lib/ai/manager')
    const evaluateCallCount = { count: 0 }
    vi.mocked(ModelManager).mockImplementationOnce(function (this: any) {
      this.getAdapter = () => ({
        generateText: vi.fn().mockImplementation(async (prompt: string) => {
          // 第一次调用生成 PRD（不是评估）
          if (prompt.includes('PRD 质量评估任务')) {
            evaluateCallCount.count++
            return JSON.stringify({
              completeness: 0.85,
              specificity: 0.80,
              logicalConsistency: 0.82,
              kpiQuality: 0.75,
              feasibility: 0.82,
              userFocus: 0.83,
              averageScore: 0.82,  // > 0.80，应该提前退出
              issues: [
                { section: '测试', issue: '测试问题', severity: 'suggestion', suggestion: '建议' },
                { section: '测试2', issue: '另一个', severity: 'warning', suggestion: '改进' },
                { section: '测试3', issue: '第三个', severity: 'warning', suggestion: '改进3' }
              ]
            })
          }
          return '## PRD 初稿\n内容'
        })
      })
      this.estimateCost = () => null
      this.getAvailableModels = () => []
    })

    const engineTest = new PRDRefinementEngine()
    const result = await engineTest.generateWithRefinement('test input', 'background context')

    // 质量分 0.82 >= 0.80，应当在第一次评估后就达到阈值，不再继续迭代
    expect(result.finalQualityScore).toBeGreaterThanOrEqual(0.80)
    // 评估应仅调用一次（第一次就达到阈值）
    expect(evaluateCallCount.count).toBe(1)
  })
})
