/**
 * 启用/禁用 API 配置
 * PATCH /api/ai/configs/:provider/toggle
 */

import { UserAPIConfigDAO } from '~/lib/db/dao/user-api-config-dao'
import type { AIProviderType } from '~/types/settings'
import { AI_PROVIDERS } from '~/lib/ai/providers'

function isValidProvider(provider: string): provider is AIProviderType {
  return provider in AI_PROVIDERS
}

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const provider = getRouterParam(event, 'provider')
    const body = await readBody<{ enabled: boolean }>(event)

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

    const updated = await UserAPIConfigDAO.setEnabled(userId, provider, body.enabled)

    if (!updated) {
      return {
        success: false,
        message: 'Configuration not found'
      }
    }

    return {
      success: true,
      message: body.enabled ? 'API 配置已启用' : 'API 配置已禁用'
    }
  } catch (error: any) {
    console.error('Failed to toggle API config:', error)

    if (error.statusCode) {
      throw error
    }

    return {
      success: false,
      message: error.message || 'Failed to toggle API configuration'
    }
  }
})
