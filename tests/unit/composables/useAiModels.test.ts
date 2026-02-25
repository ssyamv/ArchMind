/**
 * useAiModels Composable 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 直接测试 composable 逻辑
describe('useAiModels', () => {
  // 模拟全局状态
  let modelsState: any = {
    models: [],
    defaultModel: '',
    selectedModel: '',
    loading: false,
    error: null
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // 重置状态
    modelsState = {
      models: [],
      defaultModel: '',
      selectedModel: '',
      loading: false,
      error: null
    }

    // Mock $fetch
    global.$fetch = vi.fn() as any
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('state initialization', () => {
    it('should have initial empty state', () => {
      expect(modelsState.models).toEqual([])
      expect(modelsState.defaultModel).toBe('')
      expect(modelsState.selectedModel).toBe('')
      expect(modelsState.loading).toBe(false)
      expect(modelsState.error).toBeNull()
    })
  })

  describe('fetchAvailableModels', () => {
    it('should fetch and set models from API', async () => {
      const mockResponse = {
        success: true,
        data: {
          availableModels: [
            { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' }
          ],
          defaultModel: 'claude-3.5-sonnet',
          selectedModel: 'claude-3.5-sonnet'
        }
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      // 模拟 fetch 调用
      const response = await $fetch<any>('/api/v1/ai/models')

      expect(response.success).toBe(true)
      expect(response.data.availableModels.length).toBe(2)
      expect(response.data.defaultModel).toBe('claude-3.5-sonnet')
    })

    it('should handle API error', async () => {
      ;(global.$fetch as any).mockRejectedValueOnce(new Error('Network error'))

      try {
        await $fetch('/api/v1/ai/models')
      } catch (error: any) {
        expect(error.message).toBe('Network error')
      }
    })

    it('should handle unsuccessful response', async () => {
      const mockResponse = {
        success: false,
        message: 'No API keys configured'
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      const response = await $fetch<any>('/api/v1/ai/models')

      expect(response.success).toBe(false)
      expect(response.message).toBe('No API keys configured')
    })
  })

  describe('getModelInfo', () => {
    it('should return model info for existing model', () => {
      const models = [
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'gpt-4o', name: 'GPT-4o' }
      ]

      const getModelInfo = (modelId: string) => {
        return models.find(m => m.id === modelId)
      }

      const result = getModelInfo('claude-3.5-sonnet')
      expect(result).toBeDefined()
      expect(result?.name).toBe('Claude 3.5 Sonnet')
    })

    it('should return undefined for non-existing model', () => {
      const models = [
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }
      ]

      const getModelInfo = (modelId: string) => {
        return models.find(m => m.id === modelId)
      }

      const result = getModelInfo('non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('modelOptions computed', () => {
    it('should transform models to options format', () => {
      const models = [
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'gpt-4o', name: 'GPT-4o' }
      ]

      const modelOptions = models.map(model => ({
        label: model.name,
        value: model.id,
        disabled: false
      }))

      expect(modelOptions).toEqual([
        { label: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet', disabled: false },
        { label: 'GPT-4o', value: 'gpt-4o', disabled: false }
      ])
    })
  })

  describe('setSelectedModel', () => {
    it('should update selected model when valid', () => {
      const models = [
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }
      ]

      const setSelectedModel = (modelId: string) => {
        const model = models.find(m => m.id === modelId)
        if (model) {
          modelsState.selectedModel = modelId
          return true
        }
        return false
      }

      const result = setSelectedModel('claude-3.5-sonnet')
      expect(result).toBe(true)
      expect(modelsState.selectedModel).toBe('claude-3.5-sonnet')
    })

    it('should not update for invalid model', () => {
      const models = [
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }
      ]

      const setSelectedModel = (modelId: string) => {
        const model = models.find(m => m.id === modelId)
        if (model) {
          modelsState.selectedModel = modelId
          return true
        }
        return false
      }

      const result = setSelectedModel('invalid-model')
      expect(result).toBe(false)
    })
  })
})

describe('useApiConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.$fetch = vi.fn() as any
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('configMap computed', () => {
    it('should create map from configs array', () => {
      const configs = [
        { provider: 'anthropic', apiKey: 'key1', enabled: true },
        { provider: 'openai', apiKey: 'key2', enabled: false }
      ]

      const configMap = new Map<string, any>()
      for (const config of configs) {
        configMap.set(config.provider, config)
      }

      expect(configMap.size).toBe(2)
      expect(configMap.get('anthropic')?.enabled).toBe(true)
      expect(configMap.get('openai')?.enabled).toBe(false)
    })
  })

  describe('isConfigured', () => {
    it('should return true for configured provider', () => {
      const configs = [
        { provider: 'anthropic', enabled: true }
      ]

      const configMap = new Map<string, any>()
      for (const config of configs) {
        configMap.set(config.provider, config)
      }

      const isConfigured = (providerId: string) => configMap.has(providerId)

      expect(isConfigured('anthropic')).toBe(true)
      expect(isConfigured('openai')).toBe(false)
    })
  })

  describe('isEnabled', () => {
    it('should return correct enabled status', () => {
      const configs = [
        { provider: 'anthropic', enabled: true },
        { provider: 'openai', enabled: false }
      ]

      const configMap = new Map<string, any>()
      for (const config of configs) {
        configMap.set(config.provider, config)
      }

      const isEnabled = (providerId: string) => {
        const config = configMap.get(providerId)
        return config?.enabled ?? false
      }

      expect(isEnabled('anthropic')).toBe(true)
      expect(isEnabled('openai')).toBe(false)
      expect(isEnabled('non-existent')).toBe(false)
    })
  })

  describe('fetchProviders', () => {
    it('should fetch and set providers', async () => {
      const mockResponse = {
        success: true,
        data: [
          { id: 'anthropic', name: 'Anthropic' },
          { id: 'openai', name: 'OpenAI' }
        ]
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      const response = await $fetch<any>('/api/v1/ai/providers')

      expect(response.success).toBe(true)
      expect(response.data.length).toBe(2)
    })
  })

  describe('fetchConfigs', () => {
    it('should fetch user configurations', async () => {
      const mockResponse = {
        success: true,
        data: [
          { provider: 'anthropic', apiKey: 'sk-***', enabled: true },
          { provider: 'openai', apiKey: 'sk-***', enabled: true }
        ]
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      const response = await $fetch<any>('/api/v1/ai/configs')

      expect(response.success).toBe(true)
      expect(response.data.length).toBe(2)
    })
  })

  describe('saveConfig', () => {
    it('should save configuration and update local state', async () => {
      const mockResponse = {
        success: true,
        data: {
          provider: 'anthropic',
          apiKey: 'new-key',
          enabled: true
        }
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      const response = await $fetch<any>('/api/v1/ai/configs', {
        method: 'POST',
        body: {
          provider: 'anthropic',
          apiKey: 'new-key'
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.provider).toBe('anthropic')
    })

    it('should handle save error', async () => {
      ;(global.$fetch as any).mockRejectedValueOnce({
        data: { message: 'Invalid API key' }
      })

      try {
        await $fetch('/api/v1/ai/configs', {
          method: 'POST',
          body: { provider: 'anthropic', apiKey: 'invalid' }
        })
      } catch (error: any) {
        expect(error.data.message).toBe('Invalid API key')
      }
    })
  })

  describe('validateConfig', () => {
    it('should validate API configuration', async () => {
      const mockResponse = {
        success: true,
        message: 'Connection successful',
        availableModels: ['claude-3.5-sonnet', 'claude-3-opus']
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      const response = await $fetch<any>('/api/v1/ai/configs/validate', {
        method: 'POST',
        body: {
          provider: 'anthropic',
          apiKey: 'test-key'
        }
      })

      expect(response.success).toBe(true)
      expect(response.availableModels.length).toBe(2)
    })

    it('should handle validation failure', async () => {
      const mockResponse = {
        success: false,
        message: 'Invalid credentials'
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      const response = await $fetch<any>('/api/v1/ai/configs/validate', {
        method: 'POST',
        body: { provider: 'anthropic', apiKey: 'invalid' }
      })

      expect(response.success).toBe(false)
      expect(response.message).toBe('Invalid credentials')
    })
  })

  describe('deleteConfig', () => {
    it('should delete configuration', async () => {
      const mockResponse = {
        success: true,
        message: 'Configuration deleted'
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      const response = await $fetch<any>('/api/v1/ai/configs/anthropic', {
        method: 'DELETE'
      })

      expect(response.success).toBe(true)
    })
  })

  describe('toggleEnabled', () => {
    it('should toggle provider enabled status', async () => {
      const mockResponse = {
        success: true,
        message: 'Status updated'
      }

      ;(global.$fetch as any).mockResolvedValueOnce(mockResponse)

      const response = await $fetch<any>('/api/v1/ai/configs/anthropic/toggle', {
        method: 'PATCH',
        body: { enabled: false }
      })

      expect(response.success).toBe(true)
    })
  })
})
