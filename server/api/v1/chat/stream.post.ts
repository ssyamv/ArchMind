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
  workspaceId?: string
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
      prdIds: body.prdIds,
      workspaceId: body.workspaceId
    })

    // 流式生成
    const stream = engine.chatStream(body.message, body.history || [], {
      modelId,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      useRAG: body.useRAG === true && embeddingAdapter !== null,
      documentIds: body.documentIds,
      prdIds: body.prdIds,
      workspaceId: body.workspaceId
    })

    const MAX_CONTENT_LENGTH = 200_000 // 200K 字符上限，防止内存溢出

    // PRD 起始标记匹配
    const prdStartPatterns = [
      /^#\s*(PRD|产品需求文档|Product\s*Requirements?\s*Document)/m,
      /^##\s*1\.\s*产品概述/m,
      /^##\s*1\.\s*Product\s*Overview/mi,
      /^###\s*1\.\s*产品概述/m,
      /^###\s*1\.\s*Product\s*Overview/mi,
      /^##\s*一、产品概述/m,
      /^##\s*1\s+产品概述/m
    ]

    let fullContent = ''
    let prdStartIndex = -1 // -1 表示尚未检测到 PRD 起始位置

    for await (const chunk of stream) {
      fullContent += chunk
      if (fullContent.length > MAX_CONTENT_LENGTH) {
        event.node.res.write(`data: ${JSON.stringify({ error: '响应内容超过最大长度限制', done: true })}\n\n`)
        event.node.res.end()
        return
      }

      // 若尚未找到 PRD 起始位置，尝试在已累积内容中匹配
      if (prdStartIndex === -1) {
        let found = false
        for (const pattern of prdStartPatterns) {
          const match = fullContent.match(pattern)
          if (match && match.index !== undefined) {
            prdStartIndex = match.index
            found = true
            // 计算本 chunk 中 PRD 起始点的偏移量
            // fullContent = prevContent + chunk，所以 chunk 内的偏移 = prdStartIndex - (fullContent.length - chunk.length)
            const chunkPrdOffset = prdStartIndex - (fullContent.length - chunk.length)
            if (chunkPrdOffset <= 0) {
              // 起始点在之前的 chunk 中，整个当前 chunk 都是 PRD 内容
              event.node.res.write(`data: ${JSON.stringify({ chunk, prdChunk: chunk, done: false })}\n\n`)
            } else {
              // 起始点在当前 chunk 内，chunk 分为对话部分和 PRD 部分
              const dialogPart = chunk.substring(0, chunkPrdOffset)
              const prdPart = chunk.substring(chunkPrdOffset)
              event.node.res.write(`data: ${JSON.stringify({ chunk: dialogPart, done: false })}\n\n`)
              if (prdPart) {
                event.node.res.write(`data: ${JSON.stringify({ chunk: prdPart, prdChunk: prdPart, done: false })}\n\n`)
              }
            }
            break
          }
        }
        // 若本轮循环未找到起始点，发送普通 chunk
        if (!found) {
          event.node.res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`)
        }
      } else {
        // 已进入 PRD 区域，每个 chunk 同时作为 prdChunk 发送
        event.node.res.write(`data: ${JSON.stringify({ chunk, prdChunk: chunk, done: false })}\n\n`)
      }
    }

    // 判断是否包含 PRD 内容
    const isPRD = prdStartIndex !== -1

    // 发送完成信号
    event.node.res.write(`data: ${JSON.stringify({
      chunk: '',
      done: true,
      isPRD
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
