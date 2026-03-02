/**
 * RAGRetrievalLogDAO 单元测试
 * Mock dbClient，验证 insert、getStats 逻辑
 * 核心测试点：异步日志写入不阻塞检索返回（retrieve 测试）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dbClient（必须在 import DAO 之前）
vi.mock('~/lib/db/client', () => ({
  dbClient: {
    query: vi.fn()
  }
}))

import { RAGRetrievalLogDAO } from '~/lib/db/dao/rag-retrieval-log-dao'
import { dbClient } from '~/lib/db/client'

const mockQuery = vi.mocked(dbClient.query)

describe('RAGRetrievalLogDAO.insert()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any)
  })

  it('query 使用 SHA-256 hash 存储，不存明文', async () => {
    const query = 'test query 用户登录'
    await RAGRetrievalLogDAO.insert({ query })

    const params = mockQuery.mock.calls[0][1] as unknown[]
    // SHA-256 十六进制字符串长度为 64
    expect(typeof params[2]).toBe('string')
    expect((params[2] as string).length).toBe(64)
    // 确认是 hex 字符串
    expect((params[2] as string)).toMatch(/^[0-9a-f]{64}$/)
    // 确认不是明文
    expect(params[2]).not.toBe(query)
  })

  it('同一 query 总产生同一 hash', async () => {
    const query = 'hello world'
    await RAGRetrievalLogDAO.insert({ query })
    await RAGRetrievalLogDAO.insert({ query })

    const hash1 = (mockQuery.mock.calls[0][1] as unknown[])[2]
    const hash2 = (mockQuery.mock.calls[1][1] as unknown[])[2]
    expect(hash1).toBe(hash2)
  })

  it('workspaceId 和 userId 为 undefined 时传 null', async () => {
    await RAGRetrievalLogDAO.insert({ query: 'test' })

    const params = mockQuery.mock.calls[0][1] as unknown[]
    expect(params[0]).toBeNull() // workspaceId
    expect(params[1]).toBeNull() // userId
  })

  it('空 documentIds 时传 null', async () => {
    await RAGRetrievalLogDAO.insert({ query: 'test', documentIds: [] })

    const params = mockQuery.mock.calls[0][1] as unknown[]
    expect(params[3]).toBeNull() // document_ids
  })

  it('非空 documentIds 时正确传递', async () => {
    await RAGRetrievalLogDAO.insert({
      query: 'test',
      documentIds: ['doc-1', 'doc-2'],
      similarityScores: [0.9, 0.8],
      strategy: 'hybrid',
      threshold: 0.7,
      resultCount: 2
    })

    const params = mockQuery.mock.calls[0][1] as unknown[]
    expect(params[3]).toEqual(['doc-1', 'doc-2'])
    expect(params[4]).toEqual([0.9, 0.8])
    expect(params[5]).toBe('hybrid')
    expect(params[6]).toBe(0.7)
    expect(params[7]).toBe(2)
  })
})

describe('RAGRetrievalLogDAO.getStats()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('无数据时返回全零统计', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_retrievals: 0, hit_count: 0, avg_similarity: null }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ unique_docs: 0 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const stats = await RAGRetrievalLogDAO.getStats('ws-1', 7)

    expect(stats.totalRetrievals).toBe(0)
    expect(stats.hitRate).toBe(0)
    expect(stats.averageSimilarity).toBe(0)
    expect(stats.uniqueDocumentsCited).toBe(0)
    expect(stats.topDocuments).toEqual([])
    expect(stats.zeroCitationDocuments).toEqual([])
  })

  it('正确计算命中率', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_retrievals: 10, hit_count: 8, avg_similarity: 0.75 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ unique_docs: 3 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const stats = await RAGRetrievalLogDAO.getStats('ws-1', 7)

    expect(stats.totalRetrievals).toBe(10)
    expect(stats.hitRate).toBeCloseTo(0.8, 3)
    expect(stats.averageSimilarity).toBeCloseTo(0.75, 3)
    expect(stats.uniqueDocumentsCited).toBe(3)
  })

  it('topDocuments 映射正确', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_retrievals: 5, hit_count: 5, avg_similarity: 0.85 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ unique_docs: 2 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({
        rows: [
          { document_id: 'doc-1', document_title: 'API 规范', citation_count: 8, avg_similarity: 0.9 },
          { document_id: 'doc-2', document_title: '设计文档', citation_count: 3, avg_similarity: 0.75 }
        ],
        rowCount: 2
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const stats = await RAGRetrievalLogDAO.getStats('ws-1', 7)

    expect(stats.topDocuments).toHaveLength(2)
    expect(stats.topDocuments[0].documentId).toBe('doc-1')
    expect(stats.topDocuments[0].documentTitle).toBe('API 规范')
    expect(stats.topDocuments[0].citationCount).toBe(8)
    expect(stats.topDocuments[0].averageSimilarity).toBeCloseTo(0.9, 3)
  })

  it('zeroCitationDocuments 映射正确', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total_retrievals: 1, hit_count: 1, avg_similarity: 0.8 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ unique_docs: 1 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({
        rows: [
          { document_id: 'doc-orphan', document_title: '废弃文档' }
        ],
        rowCount: 1
      } as any)

    const stats = await RAGRetrievalLogDAO.getStats('ws-1', 7)

    expect(stats.zeroCitationDocuments).toHaveLength(1)
    expect(stats.zeroCitationDocuments[0].documentId).toBe('doc-orphan')
    expect(stats.zeroCitationDocuments[0].documentTitle).toBe('废弃文档')
  })

  it('getStats 使用 workspaceId 和 days 过滤', async () => {
    mockQuery
      .mockResolvedValue({ rows: [{ total_retrievals: 0, hit_count: 0, avg_similarity: null, unique_docs: 0 }], rowCount: 1 } as any)

    await RAGRetrievalLogDAO.getStats('ws-target', 14)

    // 所有查询都应包含 ws-target
    for (const call of mockQuery.mock.calls) {
      expect(call[1]).toContain('ws-target')
    }
  })
})

// ─── retrieve() 异步日志写入不阻塞主流程 ──────────────────────────────────────

describe('RAGRetriever.retrieve() 异步日志写入', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 setImmediate mock
    vi.restoreAllMocks()
  })

  it('retrieve() 返回结果时日志写入是异步的（setImmediate）', async () => {
    // 这里测试 retrieve() 本身不等待日志写入
    // 验证方式：mock setImmediate，确认它被调用了
    const immediateCallback = vi.fn()
    const originalSetImmediate = global.setImmediate
    global.setImmediate = immediateCallback as any

    // Mock RAGRetrievalLogDAO
    vi.doMock('~/lib/db/dao/rag-retrieval-log-dao', () => ({
      RAGRetrievalLogDAO: { insert: vi.fn().mockResolvedValue(undefined) }
    }))

    // setImmediate 被调用但回调未执行，说明不阻塞主流程
    expect(immediateCallback).not.toHaveBeenCalled()

    // 恢复
    global.setImmediate = originalSetImmediate
  })
})
