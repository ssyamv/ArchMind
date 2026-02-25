import type { Asset, PrdAsset } from '@/types/asset'

// ============================================
// 单例状态 (函数外部定义)
// ============================================

const STORAGE_KEY = 'archmind:assets'

const assets = ref<Asset[]>([])
const prdAssets = ref<PrdAsset[]>([])
const currentPrdId = ref<string | null>(null)
const isLoading = ref(false)
const isUploading = ref(false)
const isGenerating = ref(false)
const error = ref<string | null>(null)

// 视图模式
const viewMode = ref<'grid' | 'list'>('grid')

// ============================================
// Composable 函数
// ============================================

export function useAssets () {
  // 计算属性
  const hasAssets = computed(() => assets.value.length > 0)
  const hasPrdAssets = computed(() => prdAssets.value.length > 0)

  const uploadedAssets = computed(() =>
    assets.value.filter(a => a.source === 'upload')
  )

  const aiGeneratedAssets = computed(() =>
    assets.value.filter(a => a.source === 'ai-generated')
  )

  // ============================================
  // LocalStorage 持久化
  // ============================================

  function saveToStorage () {
    try {
      const data = {
        assets: assets.value,
        prdAssets: prdAssets.value,
        currentPrdId: currentPrdId.value,
        viewMode: viewMode.value,
        savedAt: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      console.warn('Failed to save assets to localStorage:', err)
    }
  }

  function loadFromStorage () {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return

      const data = JSON.parse(stored)
      assets.value = data.assets || []
      prdAssets.value = data.prdAssets || []
      currentPrdId.value = data.currentPrdId || null
      viewMode.value = data.viewMode || 'grid'
    } catch (err) {
      console.warn('Failed to load assets from localStorage:', err)
    }
  }

  // ============================================
  // 服务端同步
  // ============================================

  async function fetchAllAssets () {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<any>('/api/v1/assets', {
        params: { limit: 100, offset: 0 }
      })

      if (response.success) {
        assets.value = response.data.assets
        saveToStorage()
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch assets'
      console.error('Failed to fetch assets:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchPrdAssets (prdId: string) {
    if (!prdId) return

    isLoading.value = true
    error.value = null
    currentPrdId.value = prdId

    try {
      const response = await $fetch<any>(`/api/v1/assets/prd/${prdId}`)

      if (response.success) {
        prdAssets.value = response.data
        saveToStorage()
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch PRD assets'
      console.error('Failed to fetch PRD assets:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function uploadAsset (file: File, options?: {
    prdId?: string
    title?: string
    description?: string
  }) {
    isUploading.value = true
    error.value = null

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (options?.prdId) formData.append('prdId', options.prdId)
      if (options?.title) formData.append('title', options.title)
      if (options?.description) formData.append('description', options.description)

      const response = await $fetch<any>('/api/v1/assets/upload', {
        method: 'POST',
        body: formData
      })

      if (response.success) {
        // 添加到列表
        assets.value.unshift(response.data)

        // 如果绑定了 PRD, 重新获取 PRD 资源
        if (options?.prdId) {
          await fetchPrdAssets(options.prdId)
        }

        saveToStorage()
        return response.data
      }
    } catch (err: any) {
      error.value = err.message || 'Upload failed'
      console.error('Upload failed:', err)
      throw err
    } finally {
      isUploading.value = false
    }
  }

  async function deleteAsset (assetId: string) {
    error.value = null

    try {
      const response = await $fetch<any>(`/api/v1/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (response.success) {
        // 从列表移除
        assets.value = assets.value.filter(a => a.id !== assetId)
        prdAssets.value = prdAssets.value.filter(pa => pa.assetId !== assetId)

        saveToStorage()
      }
    } catch (err: any) {
      error.value = err.message || 'Delete failed'
      console.error('Delete failed:', err)
      throw err
    }
  }

  async function generateAsset (prompt: string, options: {
    modelId: string
    prdId?: string
    count?: number
  }) {
    isGenerating.value = true
    error.value = null

    try {
      const response = await $fetch<any>('/api/v1/assets/generate', {
        method: 'POST',
        body: {
          prompt,
          modelId: options.modelId,
          prdId: options.prdId,
          count: options.count || 1
        }
      })

      if (response.success) {
        // 添加到列表
        assets.value.unshift(...response.data.assets)

        // 如果绑定了 PRD
        if (options.prdId && response.data.prdAssets) {
          prdAssets.value.unshift(...response.data.prdAssets)
        }

        saveToStorage()
        return response.data.assets
      }
    } catch (err: any) {
      error.value = err.message || 'AI generation failed'
      console.error('AI generation failed:', err)
      throw err
    } finally {
      isGenerating.value = false
    }
  }

  function setViewMode (mode: 'grid' | 'list') {
    viewMode.value = mode
    saveToStorage()
  }

  function reset () {
    assets.value = []
    prdAssets.value = []
    currentPrdId.value = null
    error.value = null
    isLoading.value = false
    isUploading.value = false
    isGenerating.value = false
    viewMode.value = 'grid'
    localStorage.removeItem(STORAGE_KEY)
  }

  // ============================================
  // 返回接口
  // ============================================

  return {
    // 状态
    assets: readonly(assets),
    prdAssets: readonly(prdAssets),
    currentPrdId: readonly(currentPrdId),
    isLoading: readonly(isLoading),
    isUploading: readonly(isUploading),
    isGenerating: readonly(isGenerating),
    error: readonly(error),
    viewMode: readonly(viewMode),

    // 计算属性
    hasAssets,
    hasPrdAssets,
    uploadedAssets,
    aiGeneratedAssets,

    // 方法
    fetchAllAssets,
    fetchPrdAssets,
    uploadAsset,
    deleteAsset,
    generateAsset,
    setViewMode,
    saveToStorage,
    loadFromStorage,
    reset
  }
}
