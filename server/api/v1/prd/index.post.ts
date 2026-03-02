import { PRDGenerator } from '~/lib/prd/generator'
import { getModelManager } from '~/lib/ai/manager'
import { createEmbeddingAdapter } from '~/server/utils/embedding'
import type { PRDGenerateRequest } from '~/types/prd'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const body: PRDGenerateRequest = await readBody(event)

    if (!body.userInput) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t('errors.userInputRequired')
      }
    }

    const runtimeConfig = useRuntimeConfig()
    const glmApiKey = runtimeConfig.glmApiKey as string | undefined

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
      return {
        success: false,
        message: `Model ${modelId} is not available`
      }
    }

    // 创建 embedding adapter (如果需要 RAG)
    let embeddingAdapter
    if (body.useRAG !== false) {
      embeddingAdapter = await createEmbeddingAdapter({ glmApiKey }) ?? undefined
    }

    const generator = new PRDGenerator(embeddingAdapter ?? undefined, config)

    const result = await generator.generate(body.userInput, {
      model: modelId, // 使用选定的模型 ID
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      useRAG: body.useRAG,
      documentIds: body.documentIds,
      userId,
      workspaceId: body.workspaceId,
      parentId: body.parentId
    })

    return {
      success: true,
      data: {
        id: result.prdId,
        title: result.title,
        content: result.content,
        model: result.model,
        tokenCount: result.tokenCount,
        estimatedCost: result.estimatedCost,
        generationTime: result.generationTime,
        references: result.references
      }
    }
  } catch (error) {
    console.error('PRD generation error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
