import { Readable } from 'stream'
import { readFileSync } from 'fs'
import { join } from 'path'
import YAML from 'js-yaml'
import { PRDGenerator } from '~/lib/prd/generator'
import { getModelManager } from '~/lib/ai/manager'
import { EmbeddingServiceFactory } from '~/lib/rag/embedding-adapter'
import { triggerWebhooks } from '~/server/utils/webhook-trigger'
import type { PRDGenerateRequest } from '~/types/prd'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const body = await readBody<PRDGenerateRequest>(event)

    if (!body.userInput) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t('errors.userInputRequired')
      }
    }

    // 设置响应头用于流式传输
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')

    const runtimeConfig = useRuntimeConfig()
    const glmApiKey = runtimeConfig.glmApiKey as string | undefined
    const openaiApiKey = runtimeConfig.openaiApiKey as string | undefined
    
    // 获取模型管理器来验证选择的模型是否可用
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

    // 验证选定的模型是否可用
    const selectedModel = modelManager.getAdapter(modelId)
    if (!selectedModel) {
      setResponseStatus(event, 400)
      const response = {
        success: false,
        message: t('errors.noAiModelsConfigured')
      }
      event.node.res.write(`data: ${JSON.stringify(response)}\n\n`)
      return
    }

    // 根据用户选择的模型创建对应的 Embedding 适配器
    let embeddingAdapter = null
    if (body.useRAG) {
      console.log(`[RAG] 用户已启用 RAG，正在初始化 Embedding 服务...`)
      try {
        // 读取模型配置
        const configPath = join(process.cwd(), 'config', 'ai-models.yaml')
        const content = readFileSync(configPath, 'utf-8')
        const parsed = YAML.load(content) as { ai_models: { models: Record<string, any> } }
        const modelConfig = parsed.ai_models.models[modelId]

        if (modelConfig) {
          embeddingAdapter = await EmbeddingServiceFactory.createFromModelConfig(
            modelConfig,
            { glmApiKey, openaiApiKey }
          )

          if (!embeddingAdapter) {
            console.warn(`[RAG] 模型 ${modelId} 不支持 Embedding，RAG 功能将被禁用`)
          } else {
            const modelInfo = embeddingAdapter.getModelInfo()
            console.log(`[RAG] ✓ 已启用 ${modelInfo.provider} Embedding 服务: ${modelInfo.modelId}`)
          }
        } else {
          console.warn(`[RAG] 未找到模型 ${modelId} 的配置`)
        }
      } catch (error) {
        console.error('[RAG] 初始化 Embedding 服务失败:', error)
      }
    } else {
      console.log(`[RAG] 用户已关闭 RAG，将不使用知识库检索`)
    }
    
    // 初始化 PRD 生成器
    const generator = new PRDGenerator(
      embeddingAdapter || undefined,
      runtimeConfig
    )

    // 确定是否使用 RAG：只有在有 embedding 适配器且用户明确请求时才启用
    const enableRAG = embeddingAdapter !== null && body.useRAG === true

    // 创建可读流用于流式响应
    const asyncIterable = generator.generateStream(body.userInput, {
      model: modelId,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      useRAG: enableRAG,
      documentIds: body.documentIds,
      userId,
      workspaceId: body.workspaceId
    })

    const readable = Readable.from(asyncIterable as unknown as AsyncIterable<string>)

    // 将每个块包装成 JSON 格式
    let buffer = ''
    let isFirst = true

    for await (const chunk of readable) {
      buffer += chunk

      // 检查是否有完整的句子
      const lines = buffer.split(/[\n。]/g)

      // 保留最后一个不完整的行在 buffer 中
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim()
        if (line.length > 0) {
          const chunkEvent = {
            chunk: line,
            done: false
          }

          if (!isFirst) {
            write(chunkEvent)
          }

          write('\n')
          isFirst = false
        }
      }

      buffer = lines[lines.length - 1]
    }

    // 发送最后的内容
    if (buffer.trim().length > 0) {
      write({ chunk: buffer.trim(), done: false })
      write('\n')
    }

    // 发送完成信号
    write({ chunk: '', done: true })

    // 触发 Webhook（异步，失败不影响响应）
    if (body.workspaceId) {
      triggerWebhooks(body.workspaceId, 'prd.generated', {
        userInput: body.userInput,
        modelId,
        useRAG: enableRAG,
        userId
      })
    }

    function write(data: string | { chunk: string; done: boolean }) {
      if (typeof data === 'string') {
        event.node.res.write(data)
      } else {
        event.node.res.write(`data: ${JSON.stringify(data)}\n\n`)
      }
    }
  } catch (error) {
    console.error('Stream generation error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})




