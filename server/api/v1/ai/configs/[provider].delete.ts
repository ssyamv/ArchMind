/**
 * 删除 API 配置
 * DELETE /api/ai/configs/:provider
 */

import { UserAPIConfigDAO } from '~/lib/db/dao/user-api-config-dao'
import type { AIProviderType } from '~/types/settings'
import { AI_PROVIDERS } from '~/lib/ai/providers'
import { cache } from '~/lib/cache'
import { CacheKeys } from '~/lib/cache/keys'

function isValidProvider(provider: string): provider is AIProviderType {
  return provider in AI_PROVIDERS
}

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const provider = getRouterParam(event, 'provider')

    if (!provider) {
      throw createError({
        statusCode: 400,
        message: 'Provider is required'
      })
    }

    if (!isValidProvider(provider)) {
      throw createError({
        statusCode: 400,
        message: `Invalid provider: ${provider}`
      })
    }

    const deleted = await UserAPIConfigDAO.delete(userId, provider)

    if (!deleted) {
      return {
        success: false,
        message: 'Configuration not found'
      }
    }

    // 清除该用户的模型列表缓存
    await cache.del(CacheKeys.aiModels('all', userId))

    return {
      success: true,
      message: 'API configuration deleted successfully'
    }
  } catch (error: any) {
    console.error('Failed to delete API config:', error)

    if (error.statusCode) {
      throw error
    }

    return {
      success: false,
      message: error.message || 'Failed to delete API configuration'
    }
  }
})
