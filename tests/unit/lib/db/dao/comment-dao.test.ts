/**
 * CommentDAO 单元测试
 * Mock dbClient，测试 SQL 逻辑和数据映射
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dbClient（必须在导入 DAO 之前）
vi.mock('~/lib/db/client', () => ({
  dbClient: {
    query: vi.fn()
  }
}))

import { CommentDAO } from '~/lib/db/dao/comment-dao'
import { dbClient } from '~/lib/db/client'

const mockQuery = vi.mocked(dbClient.query)

const baseRow = {
  id: 'c1',
  workspace_id: 'ws1',
  target_type: 'prd',
  target_id: 'prd1',
  user_id: 'u1',
  username: 'Alice',
  avatar_url: null,
  content: '这是一条评论',
  mentions: [],
  resolved: false,
  resolved_by: null,
  resolved_at: null,
  created_at: '2026-02-27T00:00:00Z',
  updated_at: '2026-02-27T00:00:00Z'
}

describe('CommentDAO', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('插入评论并返回映射结果', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseRow], rowCount: 1 } as any)

      const result = await CommentDAO.create({
        workspaceId: 'ws1',
        targetType: 'prd',
        targetId: 'prd1',
        userId: 'u1',
        content: '这是一条评论',
        mentions: []
      })

      expect(mockQuery).toHaveBeenCalledOnce()
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('INSERT INTO comments')
      expect(params).toContain('ws1')
      expect(params).toContain('prd')
      expect(params).toContain('这是一条评论')

      expect(result.id).toBe('c1')
      expect(result.workspaceId).toBe('ws1')
      expect(result.targetType).toBe('prd')
      expect(result.content).toBe('这是一条评论')
      expect(result.resolved).toBe(false)
      expect(result.mentions).toEqual([])
    })

    it('mentions 默认为空数组', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseRow], rowCount: 1 } as any)

      await CommentDAO.create({
        workspaceId: 'ws1',
        targetType: 'document',
        targetId: 'doc1',
        userId: 'u1',
        content: '测试'
      })

      const params = mockQuery.mock.calls[0][1] as any[]
      // mentions 参数应为 '[]' 的 JSON 字符串
      expect(params[5]).toBe('[]')
    })
  })

  // ─── findByTarget ─────────────────────────────────────────────────────────

  describe('findByTarget', () => {
    it('查询目标资源的评论列表', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseRow, { ...baseRow, id: 'c2', content: '第二条' }], rowCount: 2 } as any)

      const result = await CommentDAO.findByTarget('prd', 'prd1', 'ws1')

      expect(mockQuery).toHaveBeenCalledOnce()
      const [sql] = mockQuery.mock.calls[0]
      expect(sql).toContain('JOIN users')
      expect(result).toHaveLength(2)
      expect(result[0].username).toBe('Alice')
    })

    it('includeResolved=false 时 SQL 含 resolved = false 过滤', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

      await CommentDAO.findByTarget('prd', 'prd1', 'ws1', { includeResolved: false })

      const [sql] = mockQuery.mock.calls[0]
      expect(sql).toContain('resolved = false')
    })
  })

  // ─── findById ────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('找到时返回评论', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseRow], rowCount: 1 } as any)

      const result = await CommentDAO.findById('c1')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('c1')
    })

    it('未找到时返回 null', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

      const result = await CommentDAO.findById('nonexistent')
      expect(result).toBeNull()
    })
  })

  // ─── resolve ─────────────────────────────────────────────────────────────

  describe('resolve', () => {
    it('标记为已解决', async () => {
      const resolvedRow = { ...baseRow, resolved: true, resolved_by: 'u2', resolved_at: '2026-02-27T01:00:00Z' }
      mockQuery.mockResolvedValueOnce({ rows: [resolvedRow], rowCount: 1 } as any)

      const result = await CommentDAO.resolve('c1', 'u2')

      expect(result).not.toBeNull()
      expect(result!.resolved).toBe(true)
      expect(result!.resolvedBy).toBe('u2')

      const [sql] = mockQuery.mock.calls[0]
      expect(sql).toContain('resolved = true')
    })

    it('评论不存在时返回 null', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

      const result = await CommentDAO.resolve('ghost', 'u2')
      expect(result).toBeNull()
    })
  })

  // ─── delete ──────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('删除成功返回 true', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 } as any)
      expect(await CommentDAO.delete('c1')).toBe(true)
    })

    it('不存在时返回 false', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      expect(await CommentDAO.delete('ghost')).toBe(false)
    })
  })

  // ─── mentions 数据格式兼容 ────────────────────────────────────────────────

  describe('mentions 字段兼容性', () => {
    it('支持 JSON 字符串格式的 mentions', async () => {
      const rowWithStringMentions = { ...baseRow, mentions: '["uuid1","uuid2"]' }
      mockQuery.mockResolvedValueOnce({ rows: [rowWithStringMentions], rowCount: 1 } as any)

      const result = await CommentDAO.findById('c1')
      expect(result!.mentions).toEqual(['uuid1', 'uuid2'])
    })

    it('支持数组格式的 mentions', async () => {
      const rowWithArrayMentions = { ...baseRow, mentions: ['uuid1'] }
      mockQuery.mockResolvedValueOnce({ rows: [rowWithArrayMentions], rowCount: 1 } as any)

      const result = await CommentDAO.findById('c1')
      expect(result!.mentions).toEqual(['uuid1'])
    })
  })
})
