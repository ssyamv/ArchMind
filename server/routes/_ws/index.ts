/**
 * WebSocket 核心处理器
 * 路由：ws://<host>/_ws
 *
 * 协议流程：
 * 1. 连接建立时服务端从 HTTP 升级请求的 Cookie 中读取 JWT 完成鉴权
 * 2. 鉴权成功后客户端可发送 join_workspace / leave_workspace / ping
 * 3. 服务端通过 peer.publish() 广播工作区事件（presence / comment / activity）
 */

// crossws 是 h3/nitro 的内部依赖，用 any 暂代其 Peer 类型
type Peer = any
import { verifyToken } from '~/server/utils/jwt'
import { wsConnectionManager } from '~/server/utils/ws-connection-manager'
import { dbClient } from '~/lib/db/client'
import type {
  WSClientMessage,
  WSServerMessage,
  WSPresenceUser
} from '~/types/websocket'

/** 心跳超时时间（毫秒）：超过此时间无心跳则断开 */
const HEARTBEAT_TIMEOUT_MS = 60_000

/** 心跳超时计时器 Map：peerId → timer */
const heartbeatTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function send(peer: Peer, msg: WSServerMessage): void {
  peer.send(JSON.stringify(msg))
}

function sendError(peer: Peer, code: string, message: string): void {
  send(peer, { type: 'error', code, message, timestamp: Date.now() })
}

function clearTimer(map: Map<string, ReturnType<typeof setTimeout>>, peerId: string): void {
  const timer = map.get(peerId)
  if (timer) {
    clearTimeout(timer)
    map.delete(peerId)
  }
}

function resetHeartbeatTimer(peer: Peer): void {
  const peerId: string = peer.id
  clearTimer(heartbeatTimers, peerId)
  heartbeatTimers.set(peerId, setTimeout(() => {
    send(peer, { type: 'error', code: 'HEARTBEAT_TIMEOUT', message: '心跳超时，连接已关闭', timestamp: Date.now() })
    peer.close(1001, 'Heartbeat timeout')
  }, HEARTBEAT_TIMEOUT_MS))
}

/** 从 WebSocket 升级请求的 Cookie 头中提取 auth_token */
function extractTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/** 查询用户基本信息（用于 Presence） */
async function fetchUserInfo(userId: string): Promise<{ username: string; avatar?: string } | null> {
  try {
    const result = await dbClient.query<{ username: string; avatar_url: string | null }>(
      'SELECT username, avatar_url FROM users WHERE id = $1',
      [userId]
    )
    if (!result.rows.length) return null
    return {
      username: result.rows[0].username,
      avatar: result.rows[0].avatar_url ?? undefined
    }
  } catch {
    return null
  }
}

// ─── 主处理器 ────────────────────────────────────────────────────────────────

export default defineWebSocketHandler({
  /**
   * 新连接建立：从 HTTP 升级请求的 Cookie 中读取 JWT 完成鉴权
   * 避免通过 JS 消息传递 token（HttpOnly cookie 无法被 JS 读取）
   */
  async open(peer) {
    const peerId: string = peer.id
    console.info(`[WS] 新连接: ${peerId}`)

    // 从升级请求的 Cookie header 中提取 JWT
    const cookieHeader = peer.request?.headers?.get('cookie') ?? null
    const token = extractTokenFromCookie(cookieHeader)

    if (!token) {
      sendError(peer, 'UNAUTHORIZED', '未提供认证 Cookie，请先登录')
      peer.close(1008, 'No auth token')
      return
    }

    const payload = verifyToken(token)
    if (!payload) {
      sendError(peer, 'UNAUTHORIZED', 'Token 无效或已过期，请重新登录')
      peer.close(1008, 'Invalid token')
      return
    }

    const userInfo = await fetchUserInfo(payload.userId)
    if (!userInfo) {
      sendError(peer, 'UNAUTHORIZED', '用户不存在')
      peer.close(1008, 'User not found')
      return
    }

    wsConnectionManager.bindUser(peerId, {
      userId: payload.userId,
      username: userInfo.username,
      avatar: userInfo.avatar
    })

    send(peer, { type: 'auth_success', userId: payload.userId, timestamp: Date.now() })
    resetHeartbeatTimer(peer)
    console.info(`[WS] 鉴权成功: userId=${payload.userId}, peerId=${peerId}`)
  },

  /**
   * 收到消息：按 type 分发处理（连接建立时已完成鉴权，无需 auth 消息）
   */
  async message(peer, raw) {
    const peerId: string = peer.id
    let msg: WSClientMessage

    // 解析 JSON
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.text()) as WSClientMessage
    } catch {
      sendError(peer, 'INVALID_JSON', '消息格式错误，需为合法 JSON')
      return
    }

    // 所有消息都需要已鉴权
    const meta = wsConnectionManager.getPeerMeta(peerId)
    if (!meta) {
      sendError(peer, 'UNAUTHORIZED', '连接未鉴权，请重新建立连接')
      return
    }

    // 重置心跳计时器
    wsConnectionManager.updateLastSeen(peerId)
    resetHeartbeatTimer(peer)

    // ── 心跳 ──
    if (msg.type === 'ping') {
      send(peer, { type: 'pong', timestamp: Date.now() })
      return
    }

    // ── 加入工作区 ──
    if (msg.type === 'join_workspace') {
      const { workspaceId } = msg

      // 验证工作区成员身份
      try {
        const result = await dbClient.query(
          'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
          [workspaceId, meta.userId]
        )
        if (!result.rows.length) {
          sendError(peer, 'FORBIDDEN', '无权访问此工作区')
          return
        }
      } catch {
        sendError(peer, 'DB_ERROR', '验证工作区权限失败')
        return
      }

      wsConnectionManager.joinWorkspace(peerId, workspaceId)
      peer.subscribe(`workspace:${workspaceId}`)

      // 推送当前在线成员列表给新加入者
      const presenceList = wsConnectionManager.getWorkspacePresence(workspaceId, peerId)
      send(peer, {
        type: 'presence_list',
        workspaceId,
        users: presenceList,
        timestamp: Date.now()
      })

      // 广播自己上线给其他成员
      const selfPresence: WSPresenceUser = {
        userId: meta.userId,
        username: meta.username,
        avatar: meta.avatar,
        status: 'online',
        lastSeen: meta.lastSeen
      }
      // publish 只发给订阅者（不含自己），因为自己已收到 presence_list
      peer.publish(`workspace:${workspaceId}`, JSON.stringify({
        type: 'presence_update',
        workspaceId,
        user: selfPresence,
        timestamp: Date.now()
      }))

      console.info(`[WS] 用户 ${meta.userId} 加入工作区 ${workspaceId}`)
      return
    }

    // ── 离开工作区 ──
    if (msg.type === 'leave_workspace') {
      const { workspaceId } = msg

      wsConnectionManager.leaveWorkspace(peerId, workspaceId)
      peer.unsubscribe(`workspace:${workspaceId}`)

      // 广播自己下线
      peer.publish(`workspace:${workspaceId}`, JSON.stringify({
        type: 'presence_update',
        workspaceId,
        user: {
          userId: meta.userId,
          username: meta.username,
          avatar: meta.avatar,
          status: 'offline',
          lastSeen: Date.now()
        } satisfies WSPresenceUser,
        timestamp: Date.now()
      }))

      console.info(`[WS] 用户 ${meta.userId} 离开工作区 ${workspaceId}`)
      return
    }

    sendError(peer, 'UNKNOWN_TYPE', `未知消息类型: ${(msg as any).type}`)
  },

  /**
   * 连接关闭：清理所有状态，广播下线通知
   */
  close(peer) {
    const peerId: string = peer.id
    clearTimer(heartbeatTimers, peerId)

    const removed = wsConnectionManager.removePeer(peerId)
    if (removed) {
      const { userId, workspaceIds } = removed
      // 向所有曾加入的工作区广播下线
      for (const workspaceId of workspaceIds) {
        peer.publish(`workspace:${workspaceId}`, JSON.stringify({
          type: 'presence_update',
          workspaceId,
          user: {
            userId,
            username: '',
            status: 'offline',
            lastSeen: Date.now()
          } satisfies WSPresenceUser,
          timestamp: Date.now()
        }))
      }
      console.info(`[WS] 连接关闭: userId=${userId}, peerId=${peerId}`)
    } else {
      console.info(`[WS] 未鉴权连接关闭: peerId=${peerId}`)
    }
  },

  /**
   * 连接错误
   */
  error(peer, error) {
    const peerId: string = peer.id
    clearTimer(heartbeatTimers, peerId)
    console.error(`[WS] 连接错误: peerId=${peerId}`, error)
  }
})
