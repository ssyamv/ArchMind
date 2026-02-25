import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { AvailableModelInfo, AvailableModelsResponse } from '~/types/settings'

export function useAiModels () {
  const models = ref<AvailableModelInfo[]>([])
  const defaultModel = ref<string>('')
  const selectedModel = ref<string>('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 获取指定模型的详细信息
  const getModelInfo = (modelId: string): AvailableModelInfo | undefined => {
    return models.value.find(m => m.id === modelId)
  }

  // 计算属性：模型选项（用于 USelect 组件）
  const modelOptions = computed(() => {
    return models.value.map(model => ({
      label: model.name,
      value: model.id,
      disabled: false
    }))
  })

  // 计算属性：当前选中的模型是否支持 Embedding
  const currentModelSupportsEmbedding = computed(() => {
    const model = getModelInfo(selectedModel.value)
    return model?.embedding?.supported ?? false
  })

  // 获取可用模型列表
  const fetchAvailableModels = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<AvailableModelsResponse>('/api/v1/ai/models')

      if (response && response.success && response.data) {
        models.value = response.data.availableModels
        defaultModel.value = response.data.defaultModel
        selectedModel.value = response.data.selectedModel || response.data.defaultModel

        // 尝试从 localStorage 恢复用户上次选择（仅在客户端）
        if (process.client) {
          const savedModel = localStorage.getItem('preferred_model_id')
          if (savedModel && models.value.some(m => m.id === savedModel)) {
            selectedModel.value = savedModel
          }
        }
      } else if (response && !response.success) {
        error.value = response.message || 'Failed to fetch models'
      } else {
        error.value = 'Invalid response from server'
      }
    } catch (err: any) {
      // $fetch throws FetchError for non-2xx responses
      // The error object may have different structures depending on the error type
      if (err._data?.message) {
        error.value = err._data.message
      } else if (err.message) {
        error.value = err.message
      } else {
        error.value = 'Failed to fetch models'
      }
      console.error('Error fetching models:', err)
    } finally {
      loading.value = false
    }
  }

  // 设置选中的模型（保存到 localStorage）
  const setSelectedModel = (modelId: string) => {
    const model = models.value.find(m => m.id === modelId)
    if (model) {
      selectedModel.value = modelId
      if (process.client) {
        localStorage.setItem('preferred_model_id', modelId)
      }
    } else {
      console.warn(`Model ${modelId} not found in available models`)
    }
  }

  // 获取当前选中的模型信息
  const currentModelInfo = computed(() => {
    const model = getModelInfo(selectedModel.value)
    return model
  })

  // 监听 API 配置更新事件，自动刷新模型列表
  const handleConfigUpdate = () => {
    fetchAvailableModels()
  }

  // 在客户端添加事件监听
  if (process.client) {
    onMounted(() => {
      window.addEventListener('api-config-updated', handleConfigUpdate)
    })

    onUnmounted(() => {
      window.removeEventListener('api-config-updated', handleConfigUpdate)
    })
  }

  return {
    models,
    defaultModel,
    selectedModel,
    loading,
    error,
    modelOptions,
    fetchAvailableModels,
    getModelInfo,
    setSelectedModel,
    currentModelInfo,
    currentModelSupportsEmbedding
  }
}


