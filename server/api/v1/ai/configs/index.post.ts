/**
 * 保存/更新 API 配置
 * POST /api/ai/configs
 */

import { UserAPIConfigDAO } from '~/lib/db/dao/user-api-config-dao'
import type { SaveAPIConfigRequest } from '~/types/settings'
import type { AIProviderType } from '~/types/settings'
import { AI_PROVIDERS } from '~/lib/ai/providers'
import { cache } from '~/lib/cache'
import { CacheKeys } from '~/lib/cache/keys'

// 验证提供商是否有效
function isValidProvider(provider: string): provider is AIProviderType {
  return provider in AI_PROVIDERS
}

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const body = await readBody<SaveAPIConfigRequest>(event)

    if (!body.provider) {
      throw createError({
        statusCode: 400,
        message: 'Provider is required'
      })
    }

    if (!isValidProvider(body.provider)) {
      throw createError({
        statusCode: 400,
        message: `Invalid provider: ${body.provider}`
      })
    }

    const providerConfig = AI_PROVIDERS[body.provider]

    // 验证必填字段
    if (providerConfig.authType === 'api_key' || providerConfig.authType === 'both') {
      // 如果是首次配置或要更新 API Key，则必须提供
      const existingConfig = await UserAPIConfigDAO.get(userId, body.provider)
      if (!existingConfig && !body.apiKey) {
        throw createError({
          statusCode: 400,
          message: 'API Key is required for this provider'
        })
      }
    }

    if (providerConfig.authType === 'base_url' || providerConfig.authType === 'both') {
      const existingConfig = await UserAPIConfigDAO.get(userId, body.provider)
      if (!existingConfig && !body.baseUrl && providerConfig.authType === 'base_url') {
        // 对于 Ollama，使用默认 URL
        body.baseUrl = body.baseUrl || providerConfig.defaultBaseUrl
      }
    }

    const config = await UserAPIConfigDAO.upsert(userId, {
      provider: body.provider,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      models: body.models,
      enabled: body.enabled ?? true
    })

    // 清除该用户的模型列表缓存（配置变更后需要重新加载）
    await cache.del(CacheKeys.aiModels('all', userId))

    return {
      success: true,
      data: config,
      message: 'API configuration saved successfully'
    }
  } catch (error: any) {
    console.error('Failed to save API config:', error)

    if (error.statusCode) {
      throw error
    }

    return {
      success: false,
      message: error.message || 'Failed to save API configuration'
    }
  }
})
