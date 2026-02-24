/**
 * 获取可用的图片生成模型列表
 */

import { getAvailableImageModels } from '~/lib/ai/image-providers'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    requireAuth(event)

    // 获取运行时配置
    const runtimeConfig = useRuntimeConfig()
    const dashscopeApiKey = runtimeConfig.dashscopeApiKey

    // 获取所有图片模型
    const allModels = getAvailableImageModels()

    // 标记哪些模型可用
    const models = allModels.map((item) => ({
      modelId: item.model.id,
      modelName: item.model.name,
      providerId: item.providerId,
      providerName: item.providerName,
      description: item.model.description,
      capabilities: item.model.capabilities,
      costEstimate: item.model.costEstimate,
      available: item.providerId === 'wanx' ? !!dashscopeApiKey : false
    }))

    // 确定默认模型
    const defaultModel = models.find((m) => m.available && m.modelId === 'wanx2.1-t2i-turbo')?.modelId
      || models.find((m) => m.available)?.modelId
      || 'wanx2.1-t2i-turbo'

    return {
      success: true,
      data: {
        models,
        defaultModel,
        hasApiKey: !!dashscopeApiKey
      }
    }
  } catch (error) {
    console.error('[Image Models] Error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : t('errors.unknownError')
    }
  }
})
