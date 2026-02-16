/**
 * PRD 迭代优化引擎
 * 实现 Draft → Review → Refine 流程，通过AI自评和迭代优化提升PRD质量
 */

import { ModelManager } from '~/lib/ai/manager'
import { RAGRetriever } from '~/lib/rag/retriever'
import { buildPRDPrompt } from '~/lib/ai/prompts/prd-system'
import { selectRelevantExamples } from '~/lib/ai/prompts/prd-examples'
import type { IEmbeddingAdapter } from '~/lib/rag/embedding-adapter'

/**
 * PRD 质量评估结果
 */
export interface PRDQualityCheck {
  completeness: number // 完整性评分 (0-1)
  specificity: number // 具体性评分 (0-1)
  logicalConsistency: number // 逻辑自洽性评分 (0-1)
  kpiQuality: number // KPI质量评分 (0-1)
  averageScore: number // 平均分 (0-1)
  issues: QualityIssue[] // 发现的问题
}

/**
 * 质量问题
 */
export interface QualityIssue {
  section: string // 问题所在章节
  issue: string // 问题描述
  severity: 'error' | 'warning' | 'suggestion' // 严重程度
  suggestion: string // 改进建议
}

/**
 * 迭代优化选项
 */
export interface RefinementOptions {
  maxIterations?: number // 最大迭代次数（默认2）
  qualityThreshold?: number // 质量阈值（默认0.85）
  model?: string // 使用的模型
  temperature?: number
  maxTokens?: number
  useRAG?: boolean
  topK?: number
}

/**
 * 带质量检查的生成结果
 */
export interface RefinedPRDResult {
  content: string // PRD内容
  qualityCheck: PRDQualityCheck // 质量评估
  iterations: number // 实际迭代次数
  initialQualityScore: number // 初始质量分
  finalQualityScore: number // 最终质量分
  improvement: number // 质量提升幅度
}

/**
 * PRD 迭代优化引擎
 */
export class PRDRefinementEngine {
  private modelManager: ModelManager
  private ragRetriever: RAGRetriever | null = null

  constructor (embeddingAdapter?: IEmbeddingAdapter, aiConfig?: Record<string, any>) {
    this.modelManager = new ModelManager(aiConfig)
    if (embeddingAdapter) {
      this.ragRetriever = new RAGRetriever(embeddingAdapter)
    }
  }

  /**
   * 生成PRD初稿
   */
  async generateDraft (
    userInput: string,
    backgroundContext: string,
    options?: RefinementOptions
  ): Promise<string> {
    const modelId = options?.model || 'claude-3.5-sonnet'
    const modelAdapter = this.modelManager.getAdapter(modelId)
    if (!modelAdapter) {
      throw new Error(`Model ${modelId} not available`)
    }

    // 选择相关的Few-shot示例
    const examples = selectRelevantExamples(userInput, 2)

    // 构建增强版Prompt
    const prompt = buildPRDPrompt(userInput, backgroundContext, examples)

    // 生成初稿
    const content = await modelAdapter.generateText(prompt, {
      temperature: options?.temperature || 0.7,
      maxTokens: options?.maxTokens || 8000
    })

    return content
  }

  /**
   * AI自评PRD质量
   */
  async evaluateQuality (prdContent: string, options?: RefinementOptions): Promise<PRDQualityCheck> {
    const modelId = options?.model || 'claude-3.5-sonnet'
    const modelAdapter = this.modelManager.getAdapter(modelId)
    if (!modelAdapter) {
      throw new Error(`Model ${modelId} not available`)
    }

    const evaluationPrompt = `# PRD 质量评估任务

请从以下4个维度评估这份PRD的质量，每个维度打分 0-1（1为最高分）：

## 评估维度

### 1. 完整性 (Completeness)
- 所有必需章节是否完整（10个章节）
- 每个章节是否充分展开（不是空泛的1-2句话）
- 是否包含足够的细节和信息量

### 2. 具体性 (Specificity)
- 是否避免模糊表述（如"提高用户体验"、"优化性能"等）
- 是否使用具体数据和示例
- 功能描述是否有明确的边界条件

### 3. 逻辑自洽性 (Logical Consistency)
- 各章节之间是否有矛盾
- 异常情况和边界条件是否覆盖
- 用户流程是否完整可行

### 4. KPI质量 (KPI Quality)
- 成功指标是否量化（是否包含具体数字）
- 是否符合SMART原则（Specific/Measurable/Achievable/Relevant/Time-bound）
- 是否有至少5个KPI

## 待评估的PRD

${prdContent}

## 输出格式

请以 **严格的JSON格式** 输出评估结果（不要包含markdown代码块标记）：

{
  "completeness": 0.85,
  "specificity": 0.70,
  "logicalConsistency": 0.90,
  "kpiQuality": 0.60,
  "averageScore": 0.76,
  "issues": [
    {
      "section": "核心功能",
      "issue": "缺少边界条件描述",
      "severity": "warning",
      "suggestion": "为每个功能添加至少3个异常情况的处理方案"
    },
    {
      "section": "成功指标",
      "issue": "KPI未量化",
      "severity": "error",
      "suggestion": "将'提高用户满意度'改为'3个月内NPS从30提升至50'"
    }
  ]
}

**注意：**
- issues数组至少列出3个问题，最多10个
- severity分为：error（必须修复）、warning（建议修复）、suggestion（可选优化）
- averageScore应为4个维度的平均值
- 输出纯JSON，不要包含\`\`\`json\`\`\`标记`

    const result = await modelAdapter.generateText(evaluationPrompt, {
      temperature: 0.3, // 低温度，保证评估一致性
      maxTokens: 2000
    })

    try {
      // 清理可能的markdown标记
      let cleanedResult = result.trim()
      if (cleanedResult.startsWith('```json')) {
        cleanedResult = cleanedResult.slice(7)
      }
      if (cleanedResult.startsWith('```')) {
        cleanedResult = cleanedResult.slice(3)
      }
      if (cleanedResult.endsWith('```')) {
        cleanedResult = cleanedResult.slice(0, -3)
      }
      cleanedResult = cleanedResult.trim()

      const qualityCheck: PRDQualityCheck = JSON.parse(cleanedResult)

      // 验证必要字段
      if (
        typeof qualityCheck.completeness !== 'number' ||
        typeof qualityCheck.specificity !== 'number' ||
        typeof qualityCheck.logicalConsistency !== 'number' ||
        typeof qualityCheck.kpiQuality !== 'number' ||
        !Array.isArray(qualityCheck.issues)
      ) {
        throw new Error('Invalid quality check format')
      }

      // 计算平均分（如果AI没提供或计算错误）
      if (!qualityCheck.averageScore) {
        qualityCheck.averageScore =
          (qualityCheck.completeness +
            qualityCheck.specificity +
            qualityCheck.logicalConsistency +
            qualityCheck.kpiQuality) /
          4
      }

      return qualityCheck
    } catch (error) {
      console.error('Failed to parse quality check result:', error)
      // 返回默认的质量检查结果
      return {
        completeness: 0.5,
        specificity: 0.5,
        logicalConsistency: 0.5,
        kpiQuality: 0.5,
        averageScore: 0.5,
        issues: [
          {
            section: '评估失败',
            issue: '无法解析AI返回的质量评估结果',
            severity: 'error',
            suggestion: '请检查PRD格式是否正确，或重新生成'
          }
        ]
      }
    }
  }

  /**
   * 根据质量评估结果优化PRD
   */
  async refine (
    draftPrd: string,
    qualityCheck: PRDQualityCheck,
    options?: RefinementOptions
  ): Promise<string> {
    const modelId = options?.model || 'claude-3.5-sonnet'
    const modelAdapter = this.modelManager.getAdapter(modelId)
    if (!modelAdapter) {
      throw new Error(`Model ${modelId} not available`)
    }

    const refinementPrompt = `# PRD 优化任务

以下PRD在质量评估中发现了一些问题，请根据评估结果优化这份PRD。

## 当前PRD

${draftPrd}

## 质量评估

- **完整性**: ${qualityCheck.completeness} / 1.0
- **具体性**: ${qualityCheck.specificity} / 1.0
- **逻辑自洽性**: ${qualityCheck.logicalConsistency} / 1.0
- **KPI质量**: ${qualityCheck.kpiQuality} / 1.0
- **平均分**: ${qualityCheck.averageScore} / 1.0

## 发现的问题

${qualityCheck.issues
  .map(
    (issue, i) =>
      `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.section}: ${issue.issue}\n   建议: ${issue.suggestion}`
  )
  .join('\n\n')}

## 优化要求

1. **保持原有结构**：不要删除或重新排序章节
2. **针对性改进**：重点解决上述发现的问题
3. **不要降低质量**：保持已有的高质量内容
4. **输出完整PRD**：输出优化后的完整PRD文档（不要只输出修改部分）

## 输出格式

请输出优化后的**完整PRD文档**（Markdown格式），包含所有10个章节。`

    const refinedContent = await modelAdapter.generateText(refinementPrompt, {
      temperature: 0.5, // 中等温度，保持创造力
      maxTokens: options?.maxTokens || 8000
    })

    return refinedContent
  }

  /**
   * 完整的迭代优化流程：Draft → Evaluate → Refine
   */
  async generateWithRefinement (
    userInput: string,
    backgroundContext: string,
    options?: RefinementOptions
  ): Promise<RefinedPRDResult> {
    const maxIterations = options?.maxIterations || 2
    const qualityThreshold = options?.qualityThreshold || 0.85

    // 步骤1：生成初稿
    let prd = await this.generateDraft(userInput, backgroundContext, options)
    let initialQualityCheck: PRDQualityCheck | null = null
    let currentQualityCheck: PRDQualityCheck | null = null

    // 步骤2：迭代优化
    for (let i = 0; i < maxIterations; i++) {
      // 评估当前质量
      currentQualityCheck = await this.evaluateQuality(prd, options)

      // 保存初始质量分
      if (i === 0) {
        initialQualityCheck = currentQualityCheck
      }

      // 如果质量达标，提前退出
      if (currentQualityCheck.averageScore >= qualityThreshold) {
        console.log(`Quality threshold reached at iteration ${i}: ${currentQualityCheck.averageScore}`)
        break
      }

      // 如果未达到最大迭代次数，继续优化
      if (i < maxIterations - 1) {
        console.log(`Refining PRD (iteration ${i + 1}/${maxIterations}), current score: ${currentQualityCheck.averageScore}`)
        prd = await this.refine(prd, currentQualityCheck, options)
      }
    }

    // 最终质量检查
    const finalQualityCheck = currentQualityCheck || (await this.evaluateQuality(prd, options))

    return {
      content: prd,
      qualityCheck: finalQualityCheck,
      iterations: initialQualityCheck
        ? initialQualityCheck.averageScore < qualityThreshold
          ? Math.ceil((qualityThreshold - initialQualityCheck.averageScore) / 0.1)
          : 0
        : 0,
      initialQualityScore: initialQualityCheck?.averageScore || 0,
      finalQualityScore: finalQualityCheck.averageScore,
      improvement: initialQualityCheck
        ? finalQualityCheck.averageScore - initialQualityCheck.averageScore
        : 0
    }
  }

  /**
   * 快速模式：仅生成初稿，不进行迭代优化
   */
  async generateQuick (
    userInput: string,
    backgroundContext: string,
    options?: RefinementOptions
  ): Promise<string> {
    return await this.generateDraft(userInput, backgroundContext, options)
  }
}
