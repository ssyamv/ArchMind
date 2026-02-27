/**
 * WebSocket 连接管理器单元测试
 * 测试 wsConnectionManager 的纯逻辑（无 IO、无 H3 依赖）
 */

import { describe, it, expect, afterEach } from 'vitest'

// wsConnectionManager 是纯 TS 模块，无需 mock 全局
// 直接导入进行测试
import { wsConnectionManager } from '~/server/utils/ws-connection-manager'

// 获取私有 Map 的辅助：通过 bindUser + getPeerMeta 验证状态

describe('wsConnectionManager', () => {
  // 每个测试前重置状态（通过 removePeer 清理）
  const cleanPeers: string[] = []

  afterEach(() => {
    for (const peerId of cleanPeers) {
      wsConnectionManager.removePeer(peerId)
    }
    cleanPeers.length = 0
  })

  // ─── bindUser ──────────────────────────────────────────────────────────────

  describe('bindUser / getPeerMeta', () => {
    it('绑定用户信息后可通过 getPeerMeta 获取', () => {
      const peerId = 'peer-001'
      cleanPeers.push(peerId)

      wsConnectionManager.bindUser(peerId, { userId: 'u1', username: 'Alice', avatar: 'https://avatar.example.com/1' })

      const meta = wsConnectionManager.getPeerMeta(peerId)
      expect(meta).toBeDefined()
      expect(meta!.userId).toBe('u1')
      expect(meta!.username).toBe('Alice')
      expect(meta!.avatar).toBe('https://avatar.example.com/1')
      expect(meta!.workspaceIds.size).toBe(0)
      expect(meta!.connectedAt).toBeGreaterThan(0)
    })

    it('未绑定的 peerId 返回 undefined', () => {
      expect(wsConnectionManager.getPeerMeta('nonexistent')).toBeUndefined()
    })
  })

  // ─── updateLastSeen ────────────────────────────────────────────────────────

  describe('updateLastSeen', () => {
    it('更新 lastSeen 时间戳', async () => {
      const peerId = 'peer-002'
      cleanPeers.push(peerId)

      wsConnectionManager.bindUser(peerId, { userId: 'u2', username: 'Bob' })
      const before = wsConnectionManager.getPeerMeta(peerId)!.lastSeen

      // 等待 1ms 确保时间戳有变化
      await new Promise(r => setTimeout(r, 5))
      wsConnectionManager.updateLastSeen(peerId)

      const after = wsConnectionManager.getPeerMeta(peerId)!.lastSeen
      expect(after).toBeGreaterThanOrEqual(before)
    })

    it('对不存在的 peer 调用不报错', () => {
      expect(() => wsConnectionManager.updateLastSeen('ghost')).not.toThrow()
    })
  })

  // ─── joinWorkspace / leaveWorkspace ────────────────────────────────────────

  describe('joinWorkspace / leaveWorkspace', () => {
    it('加入工作区后 meta.workspaceIds 包含该工作区', () => {
      const peerId = 'peer-003'
      cleanPeers.push(peerId)

      wsConnectionManager.bindUser(peerId, { userId: 'u3', username: 'Carol' })
      wsConnectionManager.joinWorkspace(peerId, 'ws-aaa')

      const meta = wsConnectionManager.getPeerMeta(peerId)!
      expect(meta.workspaceIds.has('ws-aaa')).toBe(true)
    })

    it('离开工作区后 meta.workspaceIds 不包含该工作区', () => {
      const peerId = 'peer-004'
      cleanPeers.push(peerId)

      wsConnectionManager.bindUser(peerId, { userId: 'u4', username: 'Dave' })
      wsConnectionManager.joinWorkspace(peerId, 'ws-bbb')
      wsConnectionManager.leaveWorkspace(peerId, 'ws-bbb')

      const meta = wsConnectionManager.getPeerMeta(peerId)!
      expect(meta.workspaceIds.has('ws-bbb')).toBe(false)
    })

    it('可以同时加入多个工作区', () => {
      const peerId = 'peer-005'
      cleanPeers.push(peerId)

      wsConnectionManager.bindUser(peerId, { userId: 'u5', username: 'Eve' })
      wsConnectionManager.joinWorkspace(peerId, 'ws-1')
      wsConnectionManager.joinWorkspace(peerId, 'ws-2')
      wsConnectionManager.joinWorkspace(peerId, 'ws-3')

      const meta = wsConnectionManager.getPeerMeta(peerId)!
      expect(meta.workspaceIds.size).toBe(3)
    })
  })

  // ─── getWorkspacePresence ──────────────────────────────────────────────────

  describe('getWorkspacePresence', () => {
    it('返回工作区内所有在线成员', () => {
      const peer1 = 'peer-p1'
      const peer2 = 'peer-p2'
      cleanPeers.push(peer1, peer2)

      wsConnectionManager.bindUser(peer1, { userId: 'u-p1', username: 'User1' })
      wsConnectionManager.bindUser(peer2, { userId: 'u-p2', username: 'User2' })
      wsConnectionManager.joinWorkspace(peer1, 'ws-presence')
      wsConnectionManager.joinWorkspace(peer2, 'ws-presence')

      const users = wsConnectionManager.getWorkspacePresence('ws-presence')
      expect(users).toHaveLength(2)
      const userIds = users.map(u => u.userId)
      expect(userIds).toContain('u-p1')
      expect(userIds).toContain('u-p2')
      expect(users[0].status).toBe('online')
    })

    it('excludePeerId 可排除自己', () => {
      const peer1 = 'peer-ex1'
      const peer2 = 'peer-ex2'
      cleanPeers.push(peer1, peer2)

      wsConnectionManager.bindUser(peer1, { userId: 'u-ex1', username: 'ExUser1' })
      wsConnectionManager.bindUser(peer2, { userId: 'u-ex2', username: 'ExUser2' })
      wsConnectionManager.joinWorkspace(peer1, 'ws-exclude')
      wsConnectionManager.joinWorkspace(peer2, 'ws-exclude')

      const users = wsConnectionManager.getWorkspacePresence('ws-exclude', peer1)
      expect(users).toHaveLength(1)
      expect(users[0].userId).toBe('u-ex2')
    })

    it('空工作区返回空数组', () => {
      expect(wsConnectionManager.getWorkspacePresence('ws-empty')).toEqual([])
    })
  })

  // ─── removePeer ───────────────────────────────────────────────────────────

  describe('removePeer', () => {
    it('移除 peer 后 getPeerMeta 返回 undefined', () => {
      const peerId = 'peer-rm1'

      wsConnectionManager.bindUser(peerId, { userId: 'u-rm1', username: 'Remove1' })
      wsConnectionManager.joinWorkspace(peerId, 'ws-rm')

      const result = wsConnectionManager.removePeer(peerId)
      expect(result).not.toBeNull()
      expect(result!.userId).toBe('u-rm1')
      expect(result!.workspaceIds).toContain('ws-rm')

      expect(wsConnectionManager.getPeerMeta(peerId)).toBeUndefined()
    })

    it('移除后工作区 presence 不再包含该 peer', () => {
      const peerId = 'peer-rm2'

      wsConnectionManager.bindUser(peerId, { userId: 'u-rm2', username: 'Remove2' })
      wsConnectionManager.joinWorkspace(peerId, 'ws-rm2')

      wsConnectionManager.removePeer(peerId)

      const users = wsConnectionManager.getWorkspacePresence('ws-rm2')
      expect(users.every(u => u.userId !== 'u-rm2')).toBe(true)
    })

    it('对不存在的 peer 返回 null', () => {
      expect(wsConnectionManager.removePeer('ghost-peer')).toBeNull()
    })
  })

  // ─── getWorkspaceUserIds ───────────────────────────────────────────────────

  describe('getWorkspaceUserIds', () => {
    it('返回去重的在线用户 ID 列表', () => {
      const peer1 = 'peer-uid1'
      const peer2 = 'peer-uid2'
      const peer3 = 'peer-uid3' // 同一用户两个标签页
      cleanPeers.push(peer1, peer2, peer3)

      wsConnectionManager.bindUser(peer1, { userId: 'user-same', username: 'SameUser' })
      wsConnectionManager.bindUser(peer2, { userId: 'user-diff', username: 'DiffUser' })
      wsConnectionManager.bindUser(peer3, { userId: 'user-same', username: 'SameUser' }) // 同一 userId

      wsConnectionManager.joinWorkspace(peer1, 'ws-uids')
      wsConnectionManager.joinWorkspace(peer2, 'ws-uids')
      wsConnectionManager.joinWorkspace(peer3, 'ws-uids')

      const userIds = wsConnectionManager.getWorkspaceUserIds('ws-uids')
      // 同一 userId 应去重
      expect(new Set(userIds).size).toBe(userIds.length)
      expect(userIds).toContain('user-same')
      expect(userIds).toContain('user-diff')
    })
  })
})
