/**
 * PRDFeedbackDAO 单元测试
 * Mock dbClient，测试 upsert 语义、数据映射和统计查询
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dbClient（必须在导入 DAO 之前）
vi.mock('~/lib/db/client', () => ({
  dbClient: {
    query: vi.fn()
  }
}))

import { PRDFeedbackDAO } from '~/lib/db/dao/prd-feedback-dao'
import { dbClient } from '~/lib/db/client'

const mockQuery = vi.mocked(dbClient.query)

const baseRow = {
  id: 'fb-1',
  prd_id: 'prd-1',
  user_id: 'user-1',
  rating: 4,
  positives: ['结构清晰', 'KPI 具体'],
  negatives: [],
  comment: '很不错',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z'
}

describe('PRDFeedbackDAO.upsert()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('插入新反馈时 SQL 包含 ON CONFLICT DO UPDATE', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseRow], rowCount: 1 } as any)

    await PRDFeedbackDAO.upsert({
      prdId: 'prd-1',
      userId: 'user-1',
      rating: 4,
      positives: ['结构清晰', 'KPI 具体'],
      negatives: [],
      comment: '很不错'
    })

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('ON CONFLICT')
    expect(sql).toContain('DO UPDATE SET')
    expect(params[0]).toBe('prd-1')
    expect(params[1]).toBe('user-1')
    expect(params[2]).toBe(4)
  })

  it('返回正确映射的 PRDFeedback 对象', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseRow], rowCount: 1 } as any)

    const result = await PRDFeedbackDAO.upsert({
      prdId: 'prd-1',
      userId: 'user-1',
      rating: 4
    })

    expect(result.id).toBe('fb-1')
    expect(result.prdId).toBe('prd-1')
    expect(result.userId).toBe('user-1')
    expect(result.rating).toBe(4)
    expect(result.positives).toEqual(['结构清晰', 'KPI 具体'])
    expect(result.negatives).toEqual([])
    expect(result.comment).toBe('很不错')
  })

  it('未传 positives/negatives 时传 null 给数据库', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...baseRow, positives: null, negatives: null }], rowCount: 1 } as any)

    await PRDFeedbackDAO.upsert({
      prdId: 'prd-1',
      userId: 'user-1',
      rating: 3
    })

    const params = mockQuery.mock.calls[0][1] as unknown[]
    expect(params[3]).toBeNull() // positives
    expect(params[4]).toBeNull() // negatives
  })

  it('positives/negatives 为 null 时映射为空数组', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...baseRow, positives: null, negatives: null, comment: null }],
      rowCount: 1
    } as any)

    const result = await PRDFeedbackDAO.upsert({ prdId: 'prd-1', userId: 'user-1', rating: 3 })

    expect(result.positives).toEqual([])
    expect(result.negatives).toEqual([])
    expect(result.comment).toBeNull()
  })
})

describe('PRDFeedbackDAO.findByPrdAndUser()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有反馈时返回映射结果', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [baseRow], rowCount: 1 } as any)

    const result = await PRDFeedbackDAO.findByPrdAndUser('prd-1', 'user-1')

    expect(result).not.toBeNull()
    expect(result!.rating).toBe(4)
    expect(result!.prdId).toBe('prd-1')
  })

  it('无反馈时返回 null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const result = await PRDFeedbackDAO.findByPrdAndUser('prd-1', 'user-no-feedback')
    expect(result).toBeNull()
  })

  it('SQL 使用 prd_id 和 user_id 过滤', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await PRDFeedbackDAO.findByPrdAndUser('prd-abc', 'user-xyz')

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('prd_id')
    expect(sql).toContain('user_id')
    expect(params).toContain('prd-abc')
    expect(params).toContain('user-xyz')
  })
})

describe('PRDFeedbackDAO.getQualityStats()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('无反馈时返回全 0 统计', async () => {
    // 三次查询：评分分布、positives、negatives
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)       // rating dist
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)       // positives
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)       // negatives

    const stats = await PRDFeedbackDAO.getQualityStats('ws-1')

    expect(stats.averageRating).toBe(0)
    expect(stats.totalFeedbacks).toBe(0)
    expect(stats.ratingDistribution[1]).toBe(0)
    expect(stats.ratingDistribution[5]).toBe(0)
    expect(stats.topPositives).toEqual([])
    expect(stats.topNegatives).toEqual([])
  })

  it('正确计算加权平均分', async () => {
    // 2 个 4 星 + 3 个 5 星 → (8 + 15) / 5 = 4.6
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { rating: 4, cnt: 2 },
          { rating: 5, cnt: 3 }
        ],
        rowCount: 2
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const stats = await PRDFeedbackDAO.getQualityStats('ws-1')

    expect(stats.totalFeedbacks).toBe(5)
    expect(stats.averageRating).toBeCloseTo(4.6, 2)
    expect(stats.ratingDistribution[4]).toBe(2)
    expect(stats.ratingDistribution[5]).toBe(3)
  })

  it('返回 topPositives 和 topNegatives', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ rating: 5, cnt: 1 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({
        rows: [
          { tag: '结构清晰', cnt: 5 },
          { tag: 'KPI 具体', cnt: 3 }
        ],
        rowCount: 2
      } as any)
      .mockResolvedValueOnce({
        rows: [{ tag: '内容空泛', cnt: 2 }],
        rowCount: 1
      } as any)

    const stats = await PRDFeedbackDAO.getQualityStats('ws-1', 7)

    expect(stats.topPositives).toHaveLength(2)
    expect(stats.topPositives[0]).toEqual({ label: '结构清晰', count: 5 })
    expect(stats.topNegatives).toHaveLength(1)
    expect(stats.topNegatives[0]).toEqual({ label: '内容空泛', count: 2 })
  })

  it('统计查询使用 workspaceId 过滤', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await PRDFeedbackDAO.getQualityStats('ws-target', 14)

    // 三次查询都应该包含 workspace_id 过滤参数
    for (const call of mockQuery.mock.calls) {
      expect(call[1]).toContain('ws-target')
    }
  })
})
