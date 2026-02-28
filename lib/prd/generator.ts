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
      examples: 2000, // 2个few-shot示例约2000 tokens
      context: 4000, // RAG上下文约4000 tokens
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
   * 智能上下文压缩
   */
  private compressContext (context: string, maxTokens: number = 4000): string {
    const estimatedTokens = this.estimateTokens(context)

    // 如果上下文符合预算，直接返回
    if (estimatedTokens <= maxTokens) {
      return context
    }

    // 按 --- 分割各个文档块
    const sections = context.split('\n---\n')
    const compressedSections: string[] = []
    let currentTokens = 0

    for (const section of sections) {
      const sectionTokens = this.estimateTokens(section)

      if (currentTokens + sectionTokens <= maxTokens) {
        // 整个section可以加入
        compressedSections.push(section)
        currentTokens += sectionTokens
      } else {
        // 需要压缩这个section
        // 保留前500字 + 后500字
        if (section.length > 1000) {
          const compressed =
            section.substring(0, 500) + '\n...[中间内容省略]...\n' + section.substring(section.length - 500)
          const compressedTokens = this.estimateTokens(compressed)

          if (currentTokens + compressedTokens <= maxTokens) {
            compressedSections.push(compressed)
            currentTokens += compressedTokens
          }
        } else {
          // section本身不长，但预算不够了，直接加入
          compressedSections.push(section)
          currentTokens += sectionTokens
        }
      }
    }

    return compressedSections.join('\n---\n')
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
      const retrievedChunks = await this.ragRetriever.retrieve(userInput, { topK, threshold: 0.7, userId: options?.userId })

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
      const retrievedChunks = await this.ragRetriever.retrieve(userInput, { topK, threshold: 0.7, userId: options?.userId })

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

