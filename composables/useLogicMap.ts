import { ref } from 'vue'
import type { LogicMapData, LogicMapGenerateResponse } from '~/types/logic-map'

const STORAGE_KEY = 'logicMap:active'

// 全局共享状态（单例模式）
const logicMapData = ref<LogicMapData | null>(null)
const isGenerating = ref(false)
const generationStage = ref<'idle' | 'connecting' | 'analyzing' | 'building' | 'finishing'>('idle')
const error = ref<string | null>(null)

export function useLogicMap () {

  function loadFromStorage () {
    if (!import.meta.client) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        logicMapData.value = JSON.parse(stored)
      } catch {
        // ignore parse error
      }
    }
  }

  function saveToStorage () {
    if (!import.meta.client) return
    if (logicMapData.value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logicMapData.value))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  /**
   * 从服务端数据库加载 Logic Map
   */
  async function loadByPrdId (prdId: string) {
    try {
      const response = await $fetch<{ success: boolean; data: LogicMapData | null }>(
        `/api/v1/logic-maps/${prdId}`
      )

      if (response.success && response.data) {
        logicMapData.value = response.data
        saveToStorage()
        return true
      }
      return false
    } catch (e) {
      console.error('Failed to load logic map from server:', e)
      return false
    }
  }

  async function generateFromPRD (
    prdId: string,
    options: { modelId: string }
  ) {
    isGenerating.value = true
    generationStage.value = 'connecting'
    error.value = null

    // 模拟阶段过渡，给用户更好的等待体验
    const stageTimer = setTimeout(() => {
      if (isGenerating.value) {
        generationStage.value = 'analyzing'
      }
    }, 800)

    try {
      const response = await $fetch<LogicMapGenerateResponse>(
        '/api/v1/logic-maps/generate-from-prd',
        {
          method: 'POST',
          body: {
            prdId,
            modelId: options.modelId
          }
        }
      )

      generationStage.value = 'building'

      if (response.success && response.data) {
        logicMapData.value = response.data
        saveToStorage()

        generationStage.value = 'finishing'
        // 短暂停留在 finishing 阶段，让用户看到完成动画
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        throw new Error(response.error || '生成失败')
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '未知错误'
      throw e
    } finally {
      clearTimeout(stageTimer)
      isGenerating.value = false
      generationStage.value = 'idle'
    }
  }

  function reset () {
    logicMapData.value = null
    error.value = null
    generationStage.value = 'idle'
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    logicMapData,
    isGenerating,
    generationStage,
    error,
    loadFromStorage,
    saveToStorage,
    loadByPrdId,
    generateFromPRD,
    reset
  }
}
