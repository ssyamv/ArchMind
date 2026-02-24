/**
 * 对话引擎
 * 组装对话上下文（系统提示词 + 历史消息 + RAG 检索）并调用 AI 模型
 */

import { ModelManager } from '~/lib/ai/manager'
import { RAGRetriever } from '~/lib/rag/retriever'
import { buildConversationalPrompt } from '~/lib/ai/prompts/conversation-system'
import { buildPrototypeConversationalPrompt } from '~/lib/ai/prompts/prototype-system'
import type { ChatMessage } from '~/lib/ai/types'
import type { ConversationMessage, ConversationTargetType, ConversationTargetContext } from '~/types/conversation'
import type { IEmbeddingAdapter } from '~/lib/rag/embedding-adapter'

export interface ChatStreamOptions {
  modelId?: string
  temperature?: number
  maxTokens?: number
  useRAG?: boolean
  topK?: number
  documentIds?: string[]
  prdIds?: string[]
}

export interface ChatEngineOptions {
  target?: ConversationTargetType
  targetContext?: ConversationTargetContext
  documentIds?: string[]
  prdIds?: string[]
}

const MAX_HISTORY_MESSAGES = 20

export class ChatEngine {
  private modelManager: ModelManager
  private ragRetriever: RAGRetriever | null = null
  private target: ConversationTargetType
  private targetContext?: ConversationTargetContext
  private documentIds?: string[]
  private prdIds?: string[]

  constructor (embeddingAdapter?: IEmbeddingAdapter, aiConfig?: Record<string, any>, options?: ChatEngineOptions) {
    this.modelManager = new ModelManager(aiConfig)
    if (embeddingAdapter) {
      this.ragRetriever = new RAGRetriever(embeddingAdapter)
    }
    this.target = options?.target || 'prd'
    this.targetContext = options?.targetContext
    this.documentIds = options?.documentIds
    this.prdIds = options?.prdIds
  }

  /**
   * 根据目标类型获取系统提示词
   */
  private getSystemPrompt (backgroundContext?: string): string {
    switch (this.target) {
      case 'prototype':
        return buildPrototypeConversationalPrompt(backgroundContext)
      case 'prd':
      default:
        return buildConversationalPrompt(backgroundContext)
    }
  }

  /**
   * 构建包含目标上下文的用户消息
   */
  private buildContextualMessage (currentMessage: string): string {
    if (this.target === 'prototype' && this.targetContext?.prototypeHtml) {
      return `${currentMessage}

## 当前原型内容

\`\`\`html
${this.targetContext.prototypeHtml}
\`\`\`
`
    }
    return currentMessage
  }

  /**
   * 将前端 ConversationMessage[] 转换为 ChatMessage[]
   */
  private buildMessages (
    history: ConversationMessage[],
    currentMessage: string,
    systemPrompt: string
  ): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt }
    ]

    // 限制历史消息数量，防止超出上下文窗口
    const recentHistory = history.slice(-MAX_HISTORY_MESSAGES)

    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }

    // 添加当前用户消息（可能包含目标上下文）
    messages.push({ role: 'user', content: currentMessage })

    return messages
  }

  /**
   * 流式对话生成
   */
  async * chatStream (
    currentMessage: string,
    history: ConversationMessage[],
    options?: ChatStreamOptions
  ): AsyncGenerator<string> {
    const modelId = options?.modelId || 'glm-4.7'
    const temperature = options?.temperature || 0.7
    const maxTokens = options?.maxTokens || 8000
    const useRAG = options?.useRAG === true
    const topK = options?.topK || 5

    const modelAdapter = this.modelManager.getAdapter(modelId)
    if (!modelAdapter) {
      throw new Error(`Model ${modelId} not available`)
    }

    // RAG 检索：若有 @ 提及文档或 PRD，即使 useRAG=false 也检索指定内容
    let backgroundContext = ''
    const effectiveDocumentIds = options?.documentIds ?? this.documentIds
    const effectivePrdIds = options?.prdIds ?? this.prdIds
    const hasDocumentMentions = effectiveDocumentIds && effectiveDocumentIds.length > 0
    const hasPrdMentions = effectivePrdIds && effectivePrdIds.length > 0

    if ((useRAG || hasDocumentMentions || hasPrdMentions) && this.ragRetriever) {
      if (hasPrdMentions) {
        // PRD 检索：跨不同数据表，暂不支持混合搜索，使用纯向量
        const retrievedChunks = await this.ragRetriever.retrieve(currentMessage, {
          topK,
          threshold: 0.1,
          prdIds: effectivePrdIds,
          ragStrategy: 'vector'
        })
        if (retrievedChunks.length > 0) {
          backgroundContext = this.ragRetriever.summarizeResults(retrievedChunks)
        }
      } else {
        // 文档检索：使用混合搜索（RRF）提升召回质量
        const retrievedChunks = await this.ragRetriever.retrieve(currentMessage, {
          topK,
          threshold: hasDocumentMentions ? 0.1 : 0.3,
          documentIds: hasDocumentMentions ? effectiveDocumentIds : undefined
        })
        if (retrievedChunks.length > 0) {
          backgroundContext = this.ragRetriever.summarizeResults(retrievedChunks)
        }
      }
    }

    // 根据目标类型获取系统提示词
    const systemPrompt = this.getSystemPrompt(backgroundContext)

    // 构建包含目标上下文的用户消息
    const contextualMessage = this.buildContextualMessage(currentMessage)

    // 构建完整的 messages 数组
    const messages = this.buildMessages(history, contextualMessage, systemPrompt)

    // 调用模型流式生成
    const streamIterator = modelAdapter.generateStream('', {
      temperature,
      maxTokens,
      messages
    }) as unknown as AsyncIterable<string>

    for await (const chunk of streamIterator) {
      yield chunk
    }
  }
}
