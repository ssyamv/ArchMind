/**
 * AI 模型配置 Composable
 * 管理用户的 API 配置
 */

import { ref, computed } from 'vue'
import type { AIProviderConfig, AIProviderType, UserAPIConfig, SaveAPIConfigRequest } from '~/types/settings'

export function useApiConfigs () {
  const configs = ref<UserAPIConfig[]>([])
  const providers = ref<AIProviderConfig[]>([])
  const loading = ref(false)
  const validating = ref<string | null>(null)
  const error = ref<string | null>(null)

  // 获取配置状态
  const configMap = computed(() => {
    const map = new Map<string, UserAPIConfig>()
    for (const config of configs.value) {
      map.set(config.provider, config)
    }
    return map
  })

  // 获取提供商是否已配置
  const isConfigured = (providerId: AIProviderType): boolean => {
    return configMap.value.has(providerId)
  }

  // 获取提供商是否已启用
  const isEnabled = (providerId: AIProviderType): boolean => {
    const config = configMap.value.get(providerId)
    return config?.enabled ?? false
  }

  // 获取所有已配置的提供商
  const configuredProviders = computed(() => {
    return providers.value.filter(p => isConfigured(p.id))
  })

  // 获取所有已启用的提供商
  const enabledProviders = computed(() => {
    return providers.value.filter(p => isEnabled(p.id))
  })

  // 获取提供商配置
  const getConfig = (providerId: AIProviderType): UserAPIConfig | undefined => {
    return configMap.value.get(providerId)
  }

  // 获取提供商定义
  const getProvider = (providerId: AIProviderType): AIProviderConfig | undefined => {
    return providers.value.find(p => p.id === providerId)
  }

  // 获取所有提供商定义
  const fetchProviders = async () => {
    try {
      const response = await $fetch<{ success: boolean; data: AIProviderConfig[] }>('/api/v1/ai/providers')
      if (response.success && response.data) {
        providers.value = response.data
      }
    } catch (err: any) {
      console.error('Failed to fetch providers:', err)
      error.value = err.message || 'Failed to fetch providers'
    }
  }

  // 获取所有用户配置
  const fetchConfigs = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean; data?: UserAPIConfig[]; message?: string }>('/api/v1/ai/configs')
      if (response.success && response.data) {
        configs.value = response.data
      } else if (!response.success) {
        error.value = response.message || 'Failed to fetch configurations'
      }
    } catch (err: any) {
      console.error('Failed to fetch configs:', err)
      error.value = err.data?.message || err.message || 'Failed to fetch configurations'
    } finally {
      loading.value = false
    }
  }

  // 保存配置
  const saveConfig = async (request: SaveAPIConfigRequest): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await $fetch<{ success: boolean; data?: UserAPIConfig; message?: string }>('/api/v1/ai/configs', {
        method: 'POST',
        body: request
      })

      if (response.success) {
        // 更新本地状态
        if (response.data) {
          const index = configs.value.findIndex(c => c.provider === request.provider)
          if (index >= 0) {
            configs.value[index] = response.data
          } else {
            configs.value.push(response.data)
          }
        }

        // 触发模型列表刷新事件
        if (process.client) {
          window.dispatchEvent(new CustomEvent('api-config-updated'))
        }

        return { success: true, message: response.message }
      } else {
        return { success: false, message: response.message }
      }
    } catch (err: any) {
      console.error('Failed to save config:', err)
      return { success: false, message: err.data?.message || err.message || 'Failed to save configuration' }
    }
  }

  // 验证配置
  const validateConfig = async (
    provider: AIProviderType,
    apiKey?: string,
    baseUrl?: string
  ): Promise<{ success: boolean; message?: string; availableModels?: string[]; modelsFetched?: boolean }> => {
    validating.value = provider

    try {
      const response = await $fetch<{ success: boolean; message?: string; availableModels?: string[]; modelsFetched?: boolean }>(
        '/api/v1/ai/configs/validate',
        {
          method: 'POST',
          body: { provider, apiKey, baseUrl }
        }
      )

      return {
        success: response.success,
        message: response.message,
        availableModels: response.availableModels,
        modelsFetched: response.modelsFetched
      }
    } catch (err: any) {
      console.error('Validation failed:', err)
      return {
        success: false,
        message: err.data?.message || err.message || 'Validation failed'
      }
    } finally {
      validating.value = null
    }
  }

  // 删除配置
  const deleteConfig = async (provider: AIProviderType): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await $fetch<{ success: boolean; message?: string }>(`/api/v1/ai/configs/${provider}`, {
        method: 'DELETE'
      })

      if (response.success) {
        // 更新本地状态
        configs.value = configs.value.filter(c => c.provider !== provider)
        return { success: true, message: response.message }
      } else {
        return { success: false, message: response.message }
      }
    } catch (err: any) {
      console.error('Failed to delete config:', err)
      return { success: false, message: err.data?.message || err.message || 'Failed to delete configuration' }
    }
  }

  // 切换启用状态
  const toggleEnabled = async (
    provider: AIProviderType,
    enabled: boolean
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await $fetch<{ success: boolean; message?: string }>(
        `/api/v1/ai/configs/${provider}/toggle`,
        {
          method: 'PATCH',
          body: { enabled }
        }
      )

      if (response.success) {
        // 更新本地状态
        const config = configs.value.find(c => c.provider === provider)
        if (config) {
          config.enabled = enabled
        }
        return { success: true, message: response.message }
      } else {
        return { success: false, message: response.message }
      }
    } catch (err: any) {
      console.error('Failed to toggle config:', err)
      return { success: false, message: err.data?.message || err.message || 'Failed to toggle configuration' }
    }
  }

  // 初始化：获取所有数据
  const initialize = async () => {
    await Promise.all([fetchProviders(), fetchConfigs()])
  }

  return {
    // State
    configs,
    providers,
    loading,
    validating,
    error,

    // Computed
    configMap,
    configuredProviders,
    enabledProviders,

    // Methods
    isConfigured,
    isEnabled,
    getConfig,
    getProvider,
    fetchProviders,
    fetchConfigs,
    saveConfig,
    validateConfig,
    deleteConfig,
    toggleEnabled,
    initialize
  }
}
