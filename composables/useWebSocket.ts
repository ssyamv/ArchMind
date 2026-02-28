/**
 * useWebSocket — WebSocket 客户端 Composable
 *
 * 功能：
 * - 服务端在连接建立时自动从 HttpOnly Cookie 中读取 JWT 完成鉴权
 * - 指数退避自动重连
 * - 工作区订阅管理
 * - 类型安全的消息订阅/发布
 * - 连接状态响应式暴露
 */

import { ref, computed } from 'vue'
import type {
  WSClientMessage,
  WSServerMessage,
  WSMessageType
} from '~/types/websocket'
import { useAuthStore } from '~/stores/auth'

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export type WSConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

type MessageHandler<T extends WSServerMessage = WSServerMessage> = (msg: T) => void

// ─── 重连配置 ────────────────────────────────────────────────────────────────

const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const RECONNECT_MAX_ATTEMPTS = 10
const PING_INTERVAL_MS = 30_000

// ─── 模块级单例（整个 app 共享一个 WS 连接） ─────────────────────────────────

let ws: WebSocket | null = null
const status = ref<WSConnectionStatus>('disconnected')
const reconnectAttempts = ref(0)

/** 消息处理器注册表：type → Set<handler> */
const handlerMap = new Map<WSMessageType, Set<MessageHandler<any>>>()

/** 工作区订阅集合（已 join 的 workspaceId） */
const joinedWorkspaces = new Set<string>()

let pingTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

// ─── 内部函数 ────────────────────────────────────────────────────────────────

function getWsUrl(): string {
  const config = useRuntimeConfig()
  const base = config.public.baseUrl as string
  const url = new URL(base)
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${url.host}/_ws`
}

function dispatch(msg: WSServerMessage): void {
  const handlers = handlerMap.get(msg.type)
  if (handlers) {
    for (const handler of handlers) {
      try {
        handler(msg)
      } catch (err) {
        console.error(`[WS] 消息处理器错误 type=${msg.type}`, err)
      }
    }
  }
}

function sendRaw(msg: WSClientMessage): boolean {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
    return true
  }
  return false
}

function startPing(): void {
  pingTimer = setInterval(() => {
    sendRaw({ type: 'ping', timestamp: Date.now() })
  }, PING_INTERVAL_MS)
}

function stopPing(): void {
  if (pingTimer) {
    clearInterval(pingTimer)
    pingTimer = null
  }
}

function scheduleReconnect(): void {
  if (reconnectAttempts.value >= RECONNECT_MAX_ATTEMPTS) {
    status.value = 'error'
    console.warn('[WS] 已达最大重连次数，停止重连')
    return
  }

  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts.value,
    RECONNECT_MAX_DELAY_MS
  )
  reconnectAttempts.value++
  console.info(`[WS] ${delay}ms 后第 ${reconnectAttempts.value} 次重连...`)

  reconnectTimer = setTimeout(() => {
    connect()
  }, delay)
}

function connect(): void {
  if (ws && ws.readyState !== WebSocket.CLOSED) return

  status.value = 'connecting'
  const url = getWsUrl()
  ws = new WebSocket(url)

  ws.onopen = () => {
    // 服务端在连接建立时已通过 Cookie 完成鉴权，连接即为已认证状态
    status.value = 'connected'
    reconnectAttempts.value = 0
    startPing()
    // 重新加入之前订阅的工作区
    for (const workspaceId of joinedWorkspaces) {
      sendRaw({ type: 'join_workspace', workspaceId, timestamp: Date.now() })
    }
    console.info('[WS] 连接已建立（服务端已完成鉴权）')
  }

  ws.onmessage = (event: MessageEvent) => {
    let msg: WSServerMessage
    try {
      msg = JSON.parse(event.data as string) as WSServerMessage
    } catch {
      console.error('[WS] 收到非 JSON 消息:', event.data)
      return
    }

    // 鉴权失败（服务端关闭连接时可能推送此消息）
    if (msg.type === 'auth_failed') {
      status.value = 'error'
      console.error('[WS] 鉴权失败:', msg.message)
    }

    dispatch(msg)
  }

  ws.onclose = (event: CloseEvent) => {
    stopPing()
    // 1000 = 正常关闭，1008 = 鉴权失败，不重连
    if (event.code === 1000 || event.code === 1008) {
      status.value = 'disconnected'
      return
    }
    status.value = 'disconnected'
    scheduleReconnect()
  }

  ws.onerror = (event: Event) => {
    console.error('[WS] 连接错误:', event)
  }
}

function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  stopPing()
  joinedWorkspaces.clear()
  ws?.close(1000, 'Client disconnect')
  ws = null
  status.value = 'disconnected'
  reconnectAttempts.value = 0
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useWebSocket() {
  const authStore = useAuthStore()

  const isConnected = computed(() => status.value === 'connected')
  const isConnecting = computed(() => status.value === 'connecting')

  /**
   * 初始化并建立 WebSocket 连接（幂等，多次调用安全）
   */
  function init(): void {
    if (!authStore.isAuthenticated) return
    connect()
  }

  /**
   * 加入工作区频道，开始接收该工作区的实时事件
   */
  function joinWorkspace(workspaceId: string): void {
    joinedWorkspaces.add(workspaceId)
    if (status.value === 'connected') {
      sendRaw({ type: 'join_workspace', workspaceId, timestamp: Date.now() })
    }
  }

  /**
   * 离开工作区频道
   */
  function leaveWorkspace(workspaceId: string): void {
    joinedWorkspaces.delete(workspaceId)
    if (status.value === 'connected') {
      sendRaw({ type: 'leave_workspace', workspaceId, timestamp: Date.now() })
    }
  }

  /**
   * 订阅特定类型的消息
   * @returns 取消订阅函数
   */
  function on<T extends WSServerMessage>(
    type: T['type'],
    handler: MessageHandler<T>
  ): () => void {
    if (!handlerMap.has(type)) {
      handlerMap.set(type, new Set())
    }
    handlerMap.get(type)!.add(handler as MessageHandler<any>)

    return () => {
      handlerMap.get(type)?.delete(handler as MessageHandler<any>)
    }
  }

  return {
    status,
    isConnected,
    isConnecting,
    reconnectAttempts,
    init,
    disconnect,
    joinWorkspace,
    leaveWorkspace,
    on
  }
}
