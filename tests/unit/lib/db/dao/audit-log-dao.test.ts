/**
 * AuditLogDAO 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock ────────────────────────────────────────────────────────────────────

vi.mock('~/lib/db/client', () => ({
  dbClient: {
    query: vi.fn()
  }
}))

import { AuditLogDAO } from '~/lib/db/dao/audit-log-dao'
import { dbClient } from '~/lib/db/client'

const mockQuery = dbClient.query as ReturnType<typeof vi.fn>

// ─── 工厂 ─────────────────────────────────────────────────────────────────────

function makeAuditLogRow (overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'log-uuid-1',
    user_id: 'user-uuid-1',
    workspace_id: 'ws-uuid-1',
    action: 'document.download',
    resource_type: 'document',
    resource_id: 'doc-uuid-1',
    status: 'success',
    ip_address: '127.0.0.1',
    user_agent: 'Mozilla/5.0',
    metadata: JSON.stringify({ fileName: 'test.pdf' }),
    error_message: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

// ─── 测试 ─────────────────────────────────────────────────────────────────────

describe('AuditLogDAO', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('成功写入审计日志', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })

      await AuditLogDAO.create({
        userId: 'user-1',
        workspaceId: 'ws-1',
        action: 'document.download',
        resourceType: 'document',
        resourceId: 'doc-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        metadata: { fileName: 'report.pdf' }
      })

      expect(mockQuery).toHaveBeenCalledTimes(1)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('INSERT INTO audit_logs')
      expect(params[0]).toBe('user-1')
      expect(params[2]).toBe('document.download')
      expect(params[5]).toBe('success') // 默认状态
    })

    it('数据库错误时静默处理不抛出异常', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection failed'))

      // 不应抛出异常
      await expect(AuditLogDAO.create({
        action: 'test.action'
      })).resolves.toBeUndefined()
    })

    it('未传入可选字段时使用 null', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })

      await AuditLogDAO.create({ action: 'minimal.action' })

      const params = mockQuery.mock.calls[0][1]
      expect(params[0]).toBeNull()  // userId
      expect(params[1]).toBeNull()  // workspaceId
      expect(params[3]).toBeNull()  // resourceType
      expect(params[4]).toBeNull()  // resourceId
      expect(params[6]).toBeNull()  // ipAddress
      expect(params[7]).toBeNull()  // userAgent
    })

    it('metadata 序列化为 JSON 字符串', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })

      await AuditLogDAO.create({
        action: 'test',
        metadata: { key: 'value', count: 42 }
      })

      const params = mockQuery.mock.calls[0][1]
      const metadataParam = params[8]
      expect(typeof metadataParam).toBe('string')
      expect(JSON.parse(metadataParam)).toEqual({ key: 'value', count: 42 })
    })

    it('status 字段默认为 success', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })

      await AuditLogDAO.create({ action: 'test' })

      const params = mockQuery.mock.calls[0][1]
      expect(params[5]).toBe('success')
    })

    it('可以设置 status=failure', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })

      await AuditLogDAO.create({
        action: 'auth.login',
        status: 'failure',
        errorMessage: 'Invalid password'
      })

      const params = mockQuery.mock.calls[0][1]
      expect(params[5]).toBe('failure')
      expect(params[9]).toBe('Invalid password')
    })
  })

  describe('findByUser', () => {
    it('按用户 ID 查询日志', async () => {
      const row = makeAuditLogRow()
      mockQuery.mockResolvedValueOnce({ rows: [row] })

      const logs = await AuditLogDAO.findByUser('user-uuid-1')

      expect(mockQuery).toHaveBeenCalledTimes(1)
      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('WHERE user_id = $1')
      expect(params[0]).toBe('user-uuid-1')
      expect(logs).toHaveLength(1)
    })

    it('正确映射行字段', async () => {
      const row = makeAuditLogRow()
      mockQuery.mockResolvedValueOnce({ rows: [row] })

      const logs = await AuditLogDAO.findByUser('user-uuid-1')
      const log = logs[0]

      expect(log.id).toBe('log-uuid-1')
      expect(log.userId).toBe('user-uuid-1')
      expect(log.workspaceId).toBe('ws-uuid-1')
      expect(log.action).toBe('document.download')
      expect(log.resourceType).toBe('document')
      expect(log.status).toBe('success')
      expect(log.metadata).toEqual({ fileName: 'test.pdf' })
    })

    it('metadata 为字符串时自动解析为对象', async () => {
      const row = makeAuditLogRow({ metadata: '{"parsed": true}' })
      mockQuery.mockResolvedValueOnce({ rows: [row] })

      const [log] = await AuditLogDAO.findByUser('user-1')
      expect(log.metadata).toEqual({ parsed: true })
    })

    it('metadata 为对象时直接使用', async () => {
      const row = makeAuditLogRow({ metadata: { already: 'parsed' } })
      mockQuery.mockResolvedValueOnce({ rows: [row] })

      const [log] = await AuditLogDAO.findByUser('user-1')
      expect(log.metadata).toEqual({ already: 'parsed' })
    })

    it('按 action 过滤', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      await AuditLogDAO.findByUser('user-1', { action: 'document.download' })

      const [sql] = mockQuery.mock.calls[0]
      expect(sql).toContain('AND action =')
    })

    it('支持分页参数', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      await AuditLogDAO.findByUser('user-1', { limit: 10, offset: 20 })

      const params = mockQuery.mock.calls[0][1]
      expect(params).toContain(10)
      expect(params).toContain(20)
    })

    it('无结果时返回空数组', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const logs = await AuditLogDAO.findByUser('unknown-user')
      expect(logs).toEqual([])
    })
  })

  describe('findByWorkspace', () => {
    it('按工作区 ID 查询日志', async () => {
      const rows = [makeAuditLogRow(), makeAuditLogRow({ id: 'log-2' })]
      mockQuery.mockResolvedValueOnce({ rows })

      const logs = await AuditLogDAO.findByWorkspace('ws-uuid-1')

      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toContain('WHERE workspace_id = $1')
      expect(params[0]).toBe('ws-uuid-1')
      expect(logs).toHaveLength(2)
    })

    it('支持 limit/offset 参数', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      await AuditLogDAO.findByWorkspace('ws-1', { limit: 5, offset: 10 })

      const params = mockQuery.mock.calls[0][1]
      expect(params).toContain(5)
      expect(params).toContain(10)
    })

    it('默认 limit=50 offset=0', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      await AuditLogDAO.findByWorkspace('ws-1')

      const params = mockQuery.mock.calls[0][1]
      expect(params[1]).toBe(50)
      expect(params[2]).toBe(0)
    })
  })
})
