import { readFileSync } from 'fs'
import { join } from 'path'
import YAML from 'js-yaml'
import { PrototypeGenerator } from '~/lib/prototype/generator'
import { getModelManager } from '~/lib/ai/manager'
import { EmbeddingServiceFactory } from '~/lib/rag/embedding-adapter'
import type { PrototypeStreamRequest } from '~/types/prototype'
import type { ConversationMessage } from '~/types/conversation'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    requireAuth(event)
    const body = await readBody<PrototypeStreamRequest>(event)

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
      event.node.res.write(`data: ${JSON.stringify({ error: t('errors.noAiModelsConfigured'), done: true })}\n\n`)
      event.node.res.end()
      return
    }

    // 初始化 Embedding（如果需要 RAG）
    let embeddingAdapter = null
    if (body.useRAG) {
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

    const generator = new PrototypeGenerator(embeddingAdapter || undefined, config)

    // 转换历史消息格式
    const history: ConversationMessage[] = (body.history || []).map((m, i) => ({
      id: String(i),
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: Date.now()
    }))

    // 流式生成
    const stream = generator.editByConversation(body.message, history, {
      modelId,
      temperature: body.temperature,
      maxTokens: body.maxTokens || 16000,
      useRAG: body.useRAG === true && embeddingAdapter !== null,
      currentHtml: body.currentHtml,
      prdContent: body.prdContent
    })

    let fullContent = ''
    for await (const chunk of stream) {
      fullContent += chunk
      event.node.res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`)
    }

    // 提取 HTML 内容
    const extractedHtml = PrototypeGenerator.extractHtmlFromResponse(fullContent)

    event.node.res.write(`data: ${JSON.stringify({
      chunk: '',
      done: true,
      fullHtml: extractedHtml || undefined
    })}\n\n`)
    event.node.res.end()
  } catch (error) {
    console.error('Prototype stream error:', error)
    try {
      event.node.res.write(`data: ${JSON.stringify({
        error: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR),
        done: true
      })}\n\n`)
      event.node.res.end()
    } catch {
      setResponseStatus(event, 500)
      return {
        success: false,
        message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
      }
    }
  }
})
