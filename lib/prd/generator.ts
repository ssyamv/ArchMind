/**
 * PRD 生成引擎
 * 整合 RAG 检索、AI 模型、提示词工程，实现完整的 PRD 生成流程
 */

import { ModelManager } from '~/lib/ai/manager'
import { RAGRetriever } from '~/lib/rag/retriever'
import { buildPRDPrompt } from '~/lib/ai/prompts/prd-system'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { dbClient } from '~/lib/db/client'
import { logger } from '~/lib/logger'
import type { PRDDocument } from '~/types/prd'
import type { IEmbeddingAdapter } from '~/lib/rag/embedding-adapter'

export interface PRDGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useRAG?: boolean;
  documentIds?: string[];
  topK?: number;
  enableRefinement?: boolean; // 是否启用迭代优化
  maxRefinementIterations?: number; // 最大迭代次数
  userId?: string;
  workspaceId?: string;
}

export interface PRDGenerationResult {
  prdId: string;
  title: string;
  content: string;
  model: string;
  tokenCount: number;
  estimatedCost: number;
  generationTime: number;
  references: string[]; // 引用的文档 ID
}

export class PRDGenerator {
  private modelManager: ModelManager
  private ragRetriever: RAGRetriever | null = null

  constructor (embeddingAdapter?: IEmbeddingAdapter, aiConfig?: Record<string, any>) {
    // 使用提供的配置或创建一个新的 ModelManager
    this.modelManager = new ModelManager(aiConfig)

    // 如果提供了 embedding 适配器，则初始化 RAG 检索器
    if (embeddingAdapter) {
      this.ragRetriever = new RAGRetriever(embeddingAdapter)
    }
  }

  /**
   * 估算文本的Token数量
   * 简化估算：中文约2字符/token，英文约4字符/token
   */
  private estimateTokens (text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishChars = text.length - chineseChars
    return Math.ceil(chineseChars / 2 + englishChars / 4)
  }

  /**
   * Token预算分配
   */
  private allocateTokenBudget (options?: PRDGenerationOptions) {
    const totalBudget = options?.maxTokens || 8000

    return {
      systemPrompt: 1500, // 增强版系统提示词约1500 tokens
      examples: 1500, // 精简示例预算，匀出空间给上下文（原2000）
      context: 5000, // RAG上下文约5000 tokens（原4000，压缩质量提升后可给更多空间）
      userInput: 500, // 用户输入约500 tokens
      output: totalBudget // 传给模型的 maxTokens，代表生成 token 上限
    }
  }

  /**
   * 清理 AI 在 PRD 末尾附加的闲聊性总结语
   * 策略：找到最后一个标准 PRD 章节（附录/参考）的结束位置，截断后续多余内容
   */
  private cleanTrailingChatter (content: string): string {
    // 匹配"附录与参考"章节标题（支持不同编号和写法）
    const appendixPattern = /^#{1,3}\s*(?:\d+[\.\s]*)?(?:附录|附录与参考|Appendix|References?)/m
    const match = content.match(appendixPattern)

    if (!match || match.index === undefined) {
      // 没有附录章节，尝试直接去掉末尾的闲聊段落
      return this.stripTrailingChatter(content)
    }

    // 从附录章节开始，找到附录章节的内容结束位置
    // 如果附录后还有其他"##"级别章节，说明是PRD正文，保留；否则截断
    const afterAppendix = content.slice(match.index)
    const nextTopSectionMatch = afterAppendix.match(/\n#{1,2}\s+(?!\s*(?:\d+[\.\s]*)?(?:附录|参考|Appendix|References?))/)

    if (nextTopSectionMatch && nextTopSectionMatch.index !== undefined) {
      // 附录后还有非附录的顶级章节，说明确实有多余内容，截断
      return content.slice(0, match.index + nextTopSectionMatch.index).trimEnd()
    }

    // 附录后没有其他章节，但可能有闲聊段落（无标题的纯文本）
    // 在附录内容之后，寻找空行后跟非列表、非标题的段落
    return this.stripTrailingChatter(content)
  }

  /**
   * 去掉内容末尾的闲聊性段落
   * 识别特征：句子以"您"开头、或包含"随时"/"告诉我"/"如有"等客套词
   */
  private stripTrailingChatter (content: string): string {
    const chatterPatterns = [
      /\n+(?:这份|此份|以上|以下)?(?:PRD|文档|需求文档|产品需求).{0,30}(?:为您|提供了|框架|设计|概述|完整).+$/ms,
      /\n+您可以根据.+$/ms,
      /\n+如果您.{0,20}(?:问题|需要|希望|想要).+$/ms,
      /\n+如有(?:任何)?(?:问题|疑问|需要).+$/ms,
      /\n+请随时.+$/ms,
      /\n+希望(?:这份|此)?(?:PRD|文档|内容).+$/ms
    ]

    let cleaned = content
    for (const pattern of chatterPatterns) {
      cleaned = cleaned.replace(pattern, '')
    }
    return cleaned.trimEnd()
  }

  /**
   * 语义感知上下文压缩（#52）
   * 按 Markdown 标题语义分块，基于内容重要性打分后优先保留高价值段落
   */
  private compressContext (context: string, maxTokens: number = 5000): string {
    const estimatedTokens = this.estimateTokens(context)

    // 如果上下文符合预算，直接返回
    if (estimatedTokens <= maxTokens) {
      return context
    }

    // 尝试按 Markdown 标题（## 或 ###）拆分语义段落
    const headingRegex = /^(#{2,3}\s+.+)$/m
    const parts = context.split(headingRegex)

    // 若拆不出任何标题（纯文本），退化为简单截取策略
    if (parts.length <= 1) {
      return this.fallbackTruncate(context, maxTokens)
    }

    // 重建段落列表：每个段落 = 标题 + 正文
    interface SemanticSection {
      heading: string
      body: string
      originalIndex: number
      score: number
    }
    const sections: SemanticSection[] = []
    // parts[0] 是第一个标题前的内容（序言），直接作为独立段落
    if (parts[0].trim()) {
      sections.push({
        heading: '',
        body: parts[0],
        originalIndex: 0,
        score: 0.5 // 序言给中等分
      })
    }
    for (let i = 1; i < parts.length; i += 2) {
      const heading = parts[i] || ''
      const body = parts[i + 1] || ''
      sections.push({
        heading,
        body,
        originalIndex: Math.floor(i / 2) + 1,
        score: 0
      })
    }

    // 对每个段落打重要性分
    const importantHeadingKeywords = /功能|需求|用户|目标|背景|场景|核心|关键/
    const metricPatterns = /\d+%?|KPI|指标|目标值|数据|转化率|留存率|DAU|MAU/

    for (const section of sections) {
      let score = 0

      // 维度1：标题含关键词 +0.30
      if (importantHeadingKeywords.test(section.heading)) {
        score += 0.30
      }

      // 维度2：正文含数字/指标 +0.20
      if (metricPatterns.test(section.body)) {
        score += 0.20
      }

      // 维度3：正文长度适中（100~500字）+0.10
      const bodyLength = section.body.trim().length
      if (bodyLength >= 100 && bodyLength <= 500) {
        score += 0.10
      }

      section.score = Math.min(score, 1.0)
    }

    // 按分数降序，累积 token 数直到达到预算
    const sorted = [...sections].sort((a, b) => b.score - a.score)
    // selectedTexts: originalIndex → 最终输出文本（支持截取覆盖）
    const selectedTexts = new Map<number, string>()
    let usedTokens = 0

    for (const section of sorted) {
      const text = section.heading ? `${section.heading}\n${section.body}` : section.body
      const tokenCount = this.estimateTokens(text)

      // 单段超预算时截取后加入，并终止循环
      if (tokenCount > maxTokens) {
        const maxChars = Math.floor(maxTokens * 1.5)
        const truncated = text.slice(0, maxChars) + '\n...[内容过长已截取]'
        selectedTexts.set(section.originalIndex, truncated)
        break
      }

      if (usedTokens + tokenCount <= maxTokens) {
        selectedTexts.set(section.originalIndex, text)
        usedTokens += tokenCount
      }
    }

    // 按原文顺序重新排列选中段落
    const result = sections
      .filter(s => selectedTexts.has(s.originalIndex))
      .map(s => selectedTexts.get(s.originalIndex)!)
      .join('\n\n---\n\n')

    return result || this.fallbackTruncate(context, maxTokens)
  }

  /**
   * 退化策略：纯文本无法按标题分段时的简单截取
   */
  private fallbackTruncate (context: string, maxTokens: number): string {
    const maxChars = Math.floor(maxTokens * 1.5)
    if (context.length <= maxChars) return context
    return context.slice(0, maxChars) + '\n...[内容过长已截取]'
  }

  /**
   * 生成 PRD（非流式）
   */
  async generate (
    userInput: string,
    options?: PRDGenerationOptions
  ): Promise<PRDGenerationResult> {
    const startTime = Date.now()
    const modelId = options?.model || 'claude-3.5-sonnet'
    const temperature = options?.temperature || 0.7
    const maxTokens = options?.maxTokens || 8000
    const useRAG = options?.useRAG === true // 明确要求传 true 才启用
    const topK = options?.topK || 5

    const modelAdapter = this.modelManager.getAdapter(modelId)
    if (!modelAdapter) {
      throw new Error(`Model ${modelId} not available`)
    }

    // 构建上下文
    let backgroundContext = ''
    let references: string[] = []

    if (useRAG && this.ragRetriever) {
      // 使用 RAG 检索相关文档（默认混合搜索 RRF，兼顾语义和关键词）
      const retrievedChunks = await this.ragRetriever.retrieve(userInput, { topK, threshold: 0.7, userId: options?.userId, workspaceId: options?.workspaceId })

      if (retrievedChunks.length > 0) {
        const rawContext = this.ragRetriever.summarizeResults(retrievedChunks)
        references = Array.from(new Set(retrievedChunks.map(c => c.documentId)))

        // 智能压缩上下文以符合Token预算
        const budget = this.allocateTokenBudget(options)
        backgroundContext = this.compressContext(rawContext, budget.context)
      }
    } else if (options?.documentIds && options.documentIds.length > 0) {
      // 使用指定的文档
      const docs = await Promise.all(
        options.documentIds.map(id => DocumentDAO.findById(id))
      )

      const rawContext = docs
        .filter(d => d !== null)
        .map(d => d!.content || '')
        .filter(c => c.length > 0)
        .join('\n\n---\n\n')

      // 智能压缩上下文
      const budget = this.allocateTokenBudget(options)
      backgroundContext = this.compressContext(rawContext, budget.context)

      references = options.documentIds
    }

    // 构建最终提示词
    const fullPrompt = buildPRDPrompt(userInput, backgroundContext)

    // 调用 AI 模型生成
    const rawContent = await modelAdapter.generateText(fullPrompt, {
      temperature,
      maxTokens,
      systemPrompt: undefined
    })

    // 清理末尾闲聊性内容
    const content = this.cleanTrailingChatter(rawContent)

    // 估算成本（简化计算）
    const estimatedTokens = Math.ceil((userInput.length + backgroundContext.length + content.length) / 4)
    const costEstimate = this.modelManager.estimateCost(modelId, estimatedTokens)

    // 保存到数据库
    const prd: Omit<PRDDocument, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: options?.userId,
      workspaceId: options?.workspaceId,
      title: `PRD - ${new Date().toISOString().split('T')[0]}`,
      content,
      userInput,
      modelUsed: modelId,
      generationTime: Date.now() - startTime,
      tokenCount: estimatedTokens,
      estimatedCost: costEstimate?.inputCost || 0,
      status: 'completed',
      metadata: {
        useRAG,
        temperature,
        maxTokens
      }
    }

    // 保存到数据库（使用事务确保 PRD 和引用关系的原子性）
    const savedPRD = await dbClient.transaction(async (client) => {
      const created = await PRDDAO.createWithClient(client, prd)
      if (references.length > 0) {
        await PRDDAO.addReferencesWithClient(client, created.id, references)
      }
      return created
    })

    return {
      prdId: savedPRD.id,
      title: savedPRD.title,
      content: savedPRD.content,
      model: modelId,
      tokenCount: estimatedTokens,
      estimatedCost: costEstimate?.inputCost || 0,
      generationTime: Date.now() - startTime,
      references
    }
  }

  /**
   * 流式生成 PRD
   */
  async *generateStream (
    userInput: string,
    options?: PRDGenerationOptions
  ): AsyncGenerator<string> {
    const modelId = options?.model || 'claude-3.5-sonnet'
    const temperature = options?.temperature || 0.7
    const maxTokens = options?.maxTokens || 8000
    const useRAG = options?.useRAG === true // 明确要求传 true 才启用
    const topK = options?.topK || 5

    const modelAdapter = this.modelManager.getAdapter(modelId)
    if (!modelAdapter) {
      throw new Error(`Model ${modelId} not available`)
    }

    // 构建上下文
    let backgroundContext = ''
    const references: string[] = []

    if (useRAG && this.ragRetriever) {
      // 使用 RAG 检索相关文档（默认混合搜索 RRF，兼顾语义和关键词）
      const retrievedChunks = await this.ragRetriever.retrieve(userInput, { topK, threshold: 0.7, userId: options?.userId, workspaceId: options?.workspaceId })

      if (retrievedChunks.length > 0) {
        const rawContext = this.ragRetriever.summarizeResults(retrievedChunks)

        // 智能压缩上下文
        const budget = this.allocateTokenBudget(options)
        backgroundContext = this.compressContext(rawContext, budget.context)

        references.push(...Array.from(new Set(retrievedChunks.map(c => c.documentId))))
      }
    } else if (options?.documentIds && options.documentIds.length > 0) {
      // 使用指定的文档
      const docs = await Promise.all(
        options.documentIds.map(id => DocumentDAO.findById(id))
      )

      const rawContext = docs
        .filter(d => d !== null)
        .map(d => d!.content || '')
        .filter(c => c.length > 0)
        .join('\n\n---\n\n')

      // 智能压缩上下文
      const budget = this.allocateTokenBudget(options)
      backgroundContext = this.compressContext(rawContext, budget.context)

      references.push(...options.documentIds)
    }

    // 构建最终提示词
    const fullPrompt = buildPRDPrompt(userInput, backgroundContext)

    // 流式生成内容
    const startTime = Date.now()
    let content = ''

    const streamIterator = modelAdapter.generateStream(fullPrompt, {
      temperature,
      maxTokens
    }) as unknown as AsyncIterable<string>

    for await (const chunk of streamIterator) {
      content += chunk
      yield chunk
    }

    // 异步保存到数据库（不阻塞流式响应）
    const generationTime = Date.now() - startTime
    // 清理末尾闲聊性内容后再存库（不影响已发送给前端的流式内容）
    const cleanedContent = this.cleanTrailingChatter(content)
    const estimatedTokens = Math.ceil((userInput.length + backgroundContext.length + cleanedContent.length) / 4)
    const costEstimate = this.modelManager.estimateCost(modelId, estimatedTokens)

    const prd: Omit<PRDDocument, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: options?.userId,
      workspaceId: options?.workspaceId,
      title: `PRD - ${new Date().toISOString().split('T')[0]}`,
      content: cleanedContent,
      userInput,
      modelUsed: modelId,
      generationTime,
      tokenCount: estimatedTokens,
      estimatedCost: costEstimate?.inputCost || 0,
      status: 'completed'
    }

    await dbClient.transaction(async (client) => {
      const created = await PRDDAO.createWithClient(client, prd).catch((err) => {
        logger.error({ err }, 'Failed to save PRD to database after streaming')
        throw err
      })
      if (references.length > 0) {
        await PRDDAO.addReferencesWithClient(client, created.id, references).catch((err) => {
          logger.error({ err, prdId: created.id }, 'Failed to save PRD references')
          // 引用保存失败不影响已完成的流式输出，静默处理
        })
      }
      return created
    })
  }
}

