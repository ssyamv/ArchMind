import { readFileSync } from 'fs'
import { join } from 'path'
import YAML from 'js-yaml'
import { ChatEngine } from '~/lib/chat/engine'
import { getModelManager } from '~/lib/ai/manager'
import { EmbeddingServiceFactory } from '~/lib/rag/embedding-adapter'
import type { ConversationMessage, ConversationTargetType, ConversationTargetContext } from '~/types/conversation'

interface ChatStreamRequest {
  message: string
  history?: ConversationMessage[]
  modelId?: string
  useRAG?: boolean
  temperature?: number
  maxTokens?: number
  target?: ConversationTargetType
  targetContext?: ConversationTargetContext
  documentIds?: string[]
  prdIds?: string[]
}

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    requireAuth(event)
    const body = await readBody<ChatStreamRequest>(event)

    if (!body.message) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.messageRequired') }
    }

    // 设置 SSE 响应头
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')

    const runtimeConfig = useRuntimeConfig()
    const glmApiKey = runtimeConfig.glmApiKey as string | undefined
    const openaiApiKey = runtimeConfig.openaiApiKey as string | undefined

    const config = {
      anthropicApiKey: runtimeConfig.anthropicApiKey,
      openaiApiKey: runtimeConfig.openaiApiKey,
      googleApiKey: runtimeConfig.googleApiKey,
      glmApiKey: runtimeConfig.glmApiKey,
      dashscopeApiKey: runtimeConfig.dashscopeApiKey,
      baiduApiKey: runtimeConfig.baiduApiKey,
      deepseekApiKey: runtimeConfig.deepseekApiKey,
      ollamaBaseUrl: runtimeConfig.ollamaBaseUrl
    }

    const modelManager = getModelManager(config)
    const modelId = body.modelId || modelManager.getDefaultModelId()

    // 验证模型
    const selectedModel = modelManager.getAdapter(modelId)
    if (!selectedModel) {
      event.node.res.write(`data: ${JSON.stringify({ error: t('errors.noAiModelsConfigured') })}\n\n`)
      event.node.res.end()
      return
    }

    // 初始化 Embedding（如果需要 RAG 或有 @ 提及文档/PRD）
    let embeddingAdapter = null
    if (body.useRAG || (body.documentIds && body.documentIds.length > 0) || (body.prdIds && body.prdIds.length > 0)) {
      try {
        const configPath = join(process.cwd(), 'config', 'ai-models.yaml')
        const content = readFileSync(configPath, 'utf-8')
        const parsed = YAML.load(content) as { ai_models: { models: Record<string, any> } }
        const modelConfig = parsed.ai_models.models[modelId]

        if (modelConfig) {
          embeddingAdapter = await EmbeddingServiceFactory.createFromModelConfig(
            modelConfig,
            { glmApiKey, openaiApiKey }
          )
        }
      } catch (error) {
        console.error('[RAG] 初始化 Embedding 失败:', error)
      }
    }

    // 创建对话引擎
    const engine = new ChatEngine(embeddingAdapter || undefined, config, {
      target: body.target || 'prd',
      targetContext: body.targetContext,
      documentIds: body.documentIds,
      prdIds: body.prdIds
    })

    // 流式生成
    const stream = engine.chatStream(body.message, body.history || [], {
      modelId,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      useRAG: body.useRAG === true && embeddingAdapter !== null,
      documentIds: body.documentIds,
      prdIds: body.prdIds
    })

    const MAX_CONTENT_LENGTH = 200_000 // 200K 字符上限，防止内存溢出
    let fullContent = ''
    for await (const chunk of stream) {
      fullContent += chunk
      if (fullContent.length > MAX_CONTENT_LENGTH) {
        event.node.res.write(`data: ${JSON.stringify({ error: '响应内容超过最大长度限制', done: true })}\n\n`)
        event.node.res.end()
        return
      }
      event.node.res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`)
    }

    // 判断是否包含 PRD 内容
    // 检测标准：包含结构化章节标题 + PRD 关键词
    const hasStructuredSections = fullContent.includes('## 1.') ||
                                   fullContent.includes('### 1.') ||
                                   fullContent.includes('## 2.') ||
                                   fullContent.includes('### 2.')
    const hasPrdKeywords = fullContent.includes('产品概述') ||
                           fullContent.includes('核心功能') ||
                           fullContent.includes('用户需求') ||
                           fullContent.includes('功能需求') ||
                           fullContent.includes('业务背景') ||
                           fullContent.includes('技术架构') ||
                           fullContent.includes('Product Overview') ||
                           fullContent.includes('Core Features') ||
                           fullContent.includes('User Requirements')
    const isPRD = hasStructuredSections && hasPrdKeywords

    // 提取纯 PRD 内容（去除前面的对话/思考部分）
    let prdContent = ''
    if (isPRD) {
      // 尝试匹配 PRD 标题行作为起始点
      // 匹配格式如：# PRD、# 产品需求文档、## 1. 产品概述 等
      const prdStartPatterns = [
        /^#\s*(PRD|产品需求文档|Product\s*Requirements?\s*Document)/m,
        /^##\s*1\.\s*产品概述/m,
        /^##\s*1\.\s*Product\s*Overview/mi,
        /^###\s*1\.\s*产品概述/m,
        /^###\s*1\.\s*Product\s*Overview/mi,
        /^##\s*一、产品概述/m,
        /^##\s*1\s+产品概述/m
      ]

      let prdStartIndex = -1
      for (const pattern of prdStartPatterns) {
        const match = fullContent.match(pattern)
        if (match && match.index !== undefined) {
          prdStartIndex = match.index
          break
        }
      }

      // 如果找到 PRD 起始位置，提取从那里开始的内容
      if (prdStartIndex >= 0) {
        prdContent = fullContent.substring(prdStartIndex).trim()
      } else {
        // 如果没有明确的起始标记，检查是否以常见 PRD 标题格式开头
        // 尝试找到第一个 ## 或 ### 标题作为起始点
        const headerMatch = fullContent.match(/^(#{1,3}\s+.+)$/m)
        if (headerMatch && headerMatch.index !== undefined) {
          prdContent = fullContent.substring(headerMatch.index).trim()
        } else {
          // 兜底：使用全部内容
          prdContent = fullContent
        }
      }
    }

    // 发送完成信号,如果是PRD则同时发送提取后的PRD内容
    event.node.res.write(`data: ${JSON.stringify({
      chunk: '',
      done: true,
      isPRD,
      fullContent: isPRD ? prdContent : undefined
    })}\n\n`)
    event.node.res.end()
  } catch (error) {
    console.error('Chat stream error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
