/**
 * 文档处理状态 SSE 订阅 Composable
 *
 * 替代轮询 GET /api/documents/:id/status
 * 通过 SSE 实时接收 GET /api/documents/:id/events 推送的状态变更
 *
 * 用法：
 * ```vue
 * <script setup>
 * const { status, progress, error, isCompleted, subscribe, unsubscribe } = useDocumentSSE()
 *
 * onMounted(() => subscribe(documentId))
 * onUnmounted(() => unsubscribe())
 * </script>
 * ```
 */

import { ref, computed, onUnmounted } from 'vue'

export interface DocumentStatusEvent {
  documentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  progress: number
  chunksCount: number | null
  vectorsCount: number | null
  error: string | null
  startedAt: string | null
  completedAt: string | null
}

export function useDocumentSSE () {
  const status = ref<DocumentStatusEvent['status'] | null>(null)
  const progress = ref<number>(0)
  const chunksCount = ref<number | null>(null)
  const vectorsCount = ref<number | null>(null)
  const error = ref<string | null>(null)
  const isConnected = ref(false)
  const isTimeout = ref(false)

  const isCompleted = computed(() => status.value === 'completed')
  const isFailed = computed(() => status.value === 'failed')
  const isProcessing = computed(() => status.value === 'processing' || status.value === 'pending' || status.value === 'retrying')

  let eventSource: EventSource | null = null

  /**
   * 订阅指定文档的处理状态 SSE 推送
   */
  function subscribe (documentId: string, onUpdate?: (event: DocumentStatusEvent) => void) {
    // 关闭已存在的连接
    unsubscribe()

    const url = `/api/v1/documents/${encodeURIComponent(documentId)}/events`
    eventSource = new EventSource(url)

    eventSource.addEventListener('status', (e: MessageEvent) => {
      try {
        const data: DocumentStatusEvent = JSON.parse(e.data)
        status.value = data.status
        progress.value = data.progress
        chunksCount.value = data.chunksCount
        vectorsCount.value = data.vectorsCount
        error.value = data.error

        onUpdate?.(data)

        // 终态时关闭连接（服务端也会关闭，但客户端主动关闭更干净）
        if (data.status === 'completed' || data.status === 'failed') {
          unsubscribe()
        }
      } catch (err) {
        console.error('[useDocumentSSE] Failed to parse status event:', err)
      }
    })

    eventSource.addEventListener('timeout', () => {
      isTimeout.value = true
      unsubscribe()
    })

    eventSource.addEventListener('error', () => {
      isConnected.value = false
      // EventSource 会自动重连，不需要手动处理
      // 但若连接已关闭（readyState=2），则不重连
      if (eventSource?.readyState === EventSource.CLOSED) {
        unsubscribe()
      }
    })

    eventSource.addEventListener('open', () => {
      isConnected.value = true
      isTimeout.value = false
    })
  }

  /**
   * 取消订阅，关闭 SSE 连接
   */
  function unsubscribe () {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    isConnected.value = false
  }

  /**
   * 重置所有状态
   */
  function reset () {
    unsubscribe()
    status.value = null
    progress.value = 0
    chunksCount.value = null
    vectorsCount.value = null
    error.value = null
    isTimeout.value = false
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    unsubscribe()
  })

  return {
    // 状态
    status,
    progress,
    chunksCount,
    vectorsCount,
    error,
    isConnected,
    isTimeout,

    // 计算属性
    isCompleted,
    isFailed,
    isProcessing,

    // 方法
    subscribe,
    unsubscribe,
    reset
  }
}
