/**
 * 原型图生成引擎
 * 复用 ModelManager 和 ChatEngine 的架构模式
 */

import { ModelManager } from '~/lib/ai/manager'
import { RAGRetriever } from '~/lib/rag/retriever'
import {
  buildPrototypeFromPRDPrompt,
  buildPrototypeConversationalPrompt
} from '~/lib/ai/prompts/prototype-system'
import type { ChatMessage } from '~/lib/ai/types'
import type { ConversationMessage } from '~/types/conversation'
import type { IEmbeddingAdapter } from '~/lib/rag/embedding-adapter'

export interface PrototypeGenerateOptions {
  modelId?: string
  temperature?: number
  maxTokens?: number
  useRAG?: boolean
  pageCount?: number
  deviceType?: string
}

export interface ParsedPrototypePage {
  pageSlug: string
  pageName: string
  htmlContent: string
}

const MAX_HISTORY_MESSAGES = 10

export class PrototypeGenerator {
  private modelManager: ModelManager
  private ragRetriever: RAGRetriever | null = null

  constructor (embeddingAdapter?: IEmbeddingAdapter, aiConfig?: Record<string, any>) {
    this.modelManager = new ModelManager(aiConfig)
    if (embeddingAdapter) {
      this.ragRetriever = new RAGRetriever(embeddingAdapter)
    }
  }

  /**
   * 从 PRD 内容流式生成原型 HTML
   */
  async * generateFromPRD (
    prdContent: string,
    options?: PrototypeGenerateOptions
  ): AsyncGenerator<string> {
    const modelId = options?.modelId || 'glm-4.7'
    const adapter = this.modelManager.getAdapter(modelId)
    if (!adapter) throw new Error(`Model ${modelId} not available`)

    const prompt = buildPrototypeFromPRDPrompt(prdContent, options?.pageCount, options?.deviceType)

    const stream = adapter.generateStream(prompt, {
      temperature: options?.temperature || 0.3,
      maxTokens: options?.maxTokens || 16000
    }) as unknown as AsyncIterable<string>

    for await (const chunk of stream) {
      yield chunk
    }
  }

  /**
   * 对话式编辑原型（支持历史消息上下文）
   */
  async * editByConversation (
    message: string,
    history: ConversationMessage[],
    options?: {
      modelId?: string
      temperature?: number
      maxTokens?: number
      useRAG?: boolean
      currentHtml?: string
      prdContent?: string
    }
  ): AsyncGenerator<string> {
    const modelId = options?.modelId || 'glm-4.7'
    const adapter = this.modelManager.getAdapter(modelId)
    if (!adapter) throw new Error(`Model ${modelId} not available`)

    // RAG 检索
    let backgroundContext = ''
    if (options?.useRAG && this.ragRetriever) {
      const chunks = await this.ragRetriever.retrieve(message, { topK: 5, threshold: 0.7 })
      if (chunks.length > 0) {
        backgroundContext = this.ragRetriever.summarizeResults(chunks)
      }
    }

    const systemPrompt = buildPrototypeConversationalPrompt(backgroundContext)

    // 构建 messages 数组
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt }
    ]

    // 如果有当前 HTML 上下文，注入
    if (options?.currentHtml) {
      messages.push({
        role: 'system',
        content: `当前正在编辑的 HTML 原型内容：\n\`\`\`html\n${options.currentHtml}\n\`\`\``
      })
    }

    if (options?.prdContent) {
      messages.push({
        role: 'system',
        content: `关联的 PRD 文档内容：\n${options.prdContent}`
      })
    }

    // 添加历史消息（限制最近 N 条）
    const recentHistory = history.slice(-MAX_HISTORY_MESSAGES)
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content })
    }

    messages.push({ role: 'user', content: message })

    const stream = adapter.generateStream('', {
      temperature: options?.temperature || 0.3,
      maxTokens: options?.maxTokens || 16000,
      messages
    }) as unknown as AsyncIterable<string>

    for await (const chunk of stream) {
      yield chunk
    }
  }

  /**
   * 解析 AI 输出中的多页面内容（4 层容错策略）
   */
  static parseMultiPageOutput (fullOutput: string): ParsedPrototypePage[] {
    // 层级 1：标准 PAGE 标记解析（容错大小写/多余空格）
    const result1 = PrototypeGenerator.tryParseByMarker(fullOutput)
    if (result1.length > 0) return result1

    console.warn('[Prototype] 层级1解析失败，降级到层级2（HTML 文档边界）')

    // 层级 2：按 HTML 文档边界拆分
    const result2 = PrototypeGenerator.tryParseByHtmlBoundary(fullOutput)
    if (result2.length > 0) return result2

    console.warn('[Prototype] 层级2解析失败，降级到层级3（代码块）')

    // 层级 3：提取 ```html 代码块
    const result3 = PrototypeGenerator.tryParseByCodeBlock(fullOutput)
    if (result3.length > 0) return result3

    console.warn('[Prototype] 层级3解析失败，降级到层级4（兜底）')

    // 层级 4：整体作为单页面
    return PrototypeGenerator.fallbackSinglePage(fullOutput)
  }

  /**
   * 层级 1：按 PAGE 标记拆分（容错大小写/多余空格）
   */
  private static tryParseByMarker (fullOutput: string): ParsedPrototypePage[] {
    const pages: ParsedPrototypePage[] = []
    const pageRegex = /<!--\s*PAGE\s*:\s*(\w[\w-]*)\s*:\s*(.+?)\s*-->/gi
    let match: RegExpExecArray | null
    const markers: Array<{ index: number; endIndex: number; slug: string; name: string }> = []

    while ((match = pageRegex.exec(fullOutput)) !== null) {
      markers.push({
        index: match.index,
        endIndex: match.index + match[0].length,
        slug: match[1],
        name: match[2].trim()
      })
    }

    if (markers.length === 0) return pages

    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].endIndex
      const end = i < markers.length - 1 ? markers[i + 1].index : fullOutput.length
      let htmlContent = fullOutput.slice(start, end).trim()

      // 去掉代码块标记
      const codeBlockMatch = htmlContent.match(/```html\s*\n([\s\S]*?)```/)
      if (codeBlockMatch) {
        htmlContent = codeBlockMatch[1].trim()
      }

      htmlContent = PrototypeGenerator.trimToHtml(htmlContent)

      if (htmlContent) {
        pages.push({
          pageSlug: markers[i].slug,
          pageName: markers[i].name,
          htmlContent
        })
      }
    }

    return pages
  }

  /**
   * 层级 2：按 HTML 文档边界拆分多个文档
   * 策略：找到所有 <!DOCTYPE html> 出现位置，按此拆分；
   *       若无多处 DOCTYPE，尝试查找多个裸 <html 起始位置。
   * slug 取 <title>，名称取 <h1> 或 <title>
   */
  private static tryParseByHtmlBoundary (fullOutput: string): ParsedPrototypePage[] {
    const pages: ParsedPrototypePage[] = []

    // 找到所有 <!DOCTYPE 位置
    const doctypePositions: number[] = []
    const doctypeRegex = /<!DOCTYPE\s+html/gi
    let m: RegExpExecArray | null
    while ((m = doctypeRegex.exec(fullOutput)) !== null) {
      doctypePositions.push(m.index)
    }

    // 如果只有 0-1 个 DOCTYPE，尝试找裸 <html 标签（无 DOCTYPE 的情况）
    if (doctypePositions.length < 2) {
      const htmlTagPositions: number[] = []
      const htmlRegex = /<html[\s>]/gi
      while ((m = htmlRegex.exec(fullOutput)) !== null) {
        htmlTagPositions.push(m.index)
      }
      if (htmlTagPositions.length < 2) return pages
      // 用 <html 边界拆分
      for (let i = 0; i < htmlTagPositions.length; i++) {
        const start = htmlTagPositions[i]
        const end = i < htmlTagPositions.length - 1 ? htmlTagPositions[i + 1] : fullOutput.length
        const htmlContent = fullOutput.slice(start, end).trim()
        if (htmlContent) {
          pages.push(PrototypeGenerator.buildPageFromHtml(htmlContent, i + 1))
        }
      }
      return pages
    }

    // 用 <!DOCTYPE 边界拆分
    for (let i = 0; i < doctypePositions.length; i++) {
      const start = doctypePositions[i]
      const end = i < doctypePositions.length - 1 ? doctypePositions[i + 1] : fullOutput.length
      const htmlContent = fullOutput.slice(start, end).trim()
      if (htmlContent) {
        pages.push(PrototypeGenerator.buildPageFromHtml(htmlContent, i + 1))
      }
    }

    return pages
  }

  /**
   * 从 HTML 内容中提取页面元数据
   */
  private static buildPageFromHtml (htmlContent: string, idx: number): ParsedPrototypePage {
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)
    const titleText = titleMatch ? titleMatch[1].trim() : ''
    const h1Match = htmlContent.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    const h1Text = h1Match ? h1Match[1].trim() : ''

    const pageName = h1Text || titleText || `页面 ${idx}`
    const pageSlug = titleText
      ? titleText.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 32) || `page-${idx}`
      : `page-${idx}`

    return { pageSlug, pageName, htmlContent }
  }

  /**
   * 层级 3：提取所有 ```html 代码块
   */
  private static tryParseByCodeBlock (fullOutput: string): ParsedPrototypePage[] {
    const pages: ParsedPrototypePage[] = []
    const codeBlockRegex = /```html\s*\n([\s\S]*?)```/g
    let match: RegExpExecArray | null
    let idx = 1

    while ((match = codeBlockRegex.exec(fullOutput)) !== null) {
      const htmlContent = match[1].trim()
      if (htmlContent) {
        pages.push({
          pageSlug: `page-${idx}`,
          pageName: `页面 ${idx}`,
          htmlContent
        })
        idx++
      }
    }

    return pages
  }

  /**
   * 层级 4：兜底，取 <!DOCTYPE...> 到 </html> 的内容，或原始内容
   */
  private static fallbackSinglePage (fullOutput: string): ParsedPrototypePage[] {
    // 尝试提取 <!DOCTYPE...> ... </html>
    const docMatch = fullOutput.match(/<!DOCTYPE[\s\S]*?<\/html>/i)
    const htmlContent = docMatch ? docMatch[0].trim() : fullOutput.trim()

    if (!htmlContent) return []

    return [{
      pageSlug: 'main',
      pageName: '主页面',
      htmlContent
    }]
  }

  /**
   * 确保 HTML 内容从 <!DOCTYPE 或 <html 开始
   */
  private static trimToHtml (content: string): string {
    if (content.startsWith('<!DOCTYPE') || content.startsWith('<html')) {
      return content
    }
    const docIdx = content.indexOf('<!DOCTYPE')
    if (docIdx > -1) return content.slice(docIdx)
    const htmlIdx = content.indexOf('<html')
    if (htmlIdx > -1) return content.slice(htmlIdx)
    return content
  }

  /**
   * 从 AI 对话回复中提取 HTML 代码块
   */
  static extractHtmlFromResponse (content: string): string | null {
    const match = content.match(/```html\s*\n([\s\S]*?)```/)
    return match ? match[1].trim() : null
  }
}
