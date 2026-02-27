/**
 * WebSocket 连接管理器
 *
 * 负责维护所有活跃连接的状态：
 * - peer → userId 映射（鉴权后绑定）
 * - workspaceId → Set<peerId> 房间映射
 * - userId 的基本信息缓存（用于 Presence 推送）
 */

import type { WSPresenceUser } from '~/types/websocket'

export interface PeerMeta {
  userId: string
  username: string
  avatar?: string
  workspaceIds: Set<string>
  connectedAt: number
  lastSeen: number
}

/**
 * 全局连接状态（模块级单例，进程内共享）
 * key: peerId (peer.toString())
 */
const peerMetaMap = new Map<string, PeerMeta>()

/**
 * 工作区房间映射
 * key: workspaceId，value: Set<peerId>
 */
const workspaceRoomMap = new Map<string, Set<string>>()

export const wsConnectionManager = {
  /** 绑定已鉴权的用户信息到 peer */
  bindUser(peerId: string, meta: Omit<PeerMeta, 'workspaceIds' | 'connectedAt' | 'lastSeen'>): void {
    peerMetaMap.set(peerId, {
      ...meta,
      workspaceIds: new Set(),
      connectedAt: Date.now(),
      lastSeen: Date.now()
    })
  },

  /** 获取 peer 绑定的用户信息 */
  getPeerMeta(peerId: string): PeerMeta | undefined {
    return peerMetaMap.get(peerId)
  },

  /** 更新 lastSeen（心跳时调用） */
  updateLastSeen(peerId: string): void {
    const meta = peerMetaMap.get(peerId)
    if (meta) meta.lastSeen = Date.now()
  },

  /** peer 加入工作区房间 */
  joinWorkspace(peerId: string, workspaceId: string): void {
    const meta = peerMetaMap.get(peerId)
    if (meta) meta.workspaceIds.add(workspaceId)

    if (!workspaceRoomMap.has(workspaceId)) {
      workspaceRoomMap.set(workspaceId, new Set())
    }
    workspaceRoomMap.get(workspaceId)!.add(peerId)
  },

  /** peer 离开工作区房间 */
  leaveWorkspace(peerId: string, workspaceId: string): void {
    const meta = peerMetaMap.get(peerId)
    if (meta) meta.workspaceIds.delete(workspaceId)

    workspaceRoomMap.get(workspaceId)?.delete(peerId)
    if (workspaceRoomMap.get(workspaceId)?.size === 0) {
      workspaceRoomMap.delete(workspaceId)
    }
  },

  /** peer 断开连接，清理所有状态 */
  removePeer(peerId: string): { userId: string; workspaceIds: string[] } | null {
    const meta = peerMetaMap.get(peerId)
    if (!meta) return null

    const workspaceIds = [...meta.workspaceIds]
    for (const wid of workspaceIds) {
      this.leaveWorkspace(peerId, wid)
    }
    peerMetaMap.delete(peerId)

    return { userId: meta.userId, workspaceIds }
  },

  /** 获取工作区内所有在线成员（排除指定 peer） */
  getWorkspacePresence(workspaceId: string, excludePeerId?: string): WSPresenceUser[] {
    const peerIds = workspaceRoomMap.get(workspaceId)
    if (!peerIds) return []

    const users: WSPresenceUser[] = []
    for (const peerId of peerIds) {
      if (peerId === excludePeerId) continue
      const meta = peerMetaMap.get(peerId)
      if (!meta) continue
      users.push({
        userId: meta.userId,
        username: meta.username,
        avatar: meta.avatar,
        status: 'online',
        lastSeen: meta.lastSeen
      })
    }
    return users
  },

  /** 获取工作区内所有 peerId（用于广播） */
  getWorkspacePeerIds(workspaceId: string): string[] {
    return [...(workspaceRoomMap.get(workspaceId) ?? [])]
  },

  /** 获取工作区内所有在线的 userId（去重） */
  getWorkspaceUserIds(workspaceId: string): string[] {
    const peerIds = workspaceRoomMap.get(workspaceId) ?? new Set<string>()
    const userIds = new Set<string>()
    for (const peerId of peerIds) {
      const meta = peerMetaMap.get(peerId)
      if (meta) userIds.add(meta.userId)
    }
    return [...userIds]
  }
}
