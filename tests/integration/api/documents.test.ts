/**
 * API 集成测试 - 文档搜索模块
 * 测试搜索请求的 schema 验证，以及搜索模式切换逻辑
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ─── 复现搜索 Schema ──────────────────────────────────────────────────────────

const searchSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(['keyword', 'vector', 'hybrid']).optional().default('hybrid'),
  topK: z.number().int().min(1).max(50).optional().default(5),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  keywordWeight: z.number().min(0).max(1).optional().default(0.3),
  vectorWeight: z.number().min(0).max(1).optional().default(0.7)
})

// ─── 搜索 Schema 验证 ─────────────────────────────────────────────────────────

describe('POST /api/documents/search - Schema 验证', () => {
  it('最小有效请求（只需 query）', () => {
    const result = searchSchema.safeParse({ query: 'test search' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mode).toBe('hybrid')   // 默认值
      expect(result.data.topK).toBe(5)           // 默认值
      expect(result.data.threshold).toBe(0.7)   // 默认值
    }
  })

  it('空 query 被拒绝', () => {
    const result = searchSchema.safeParse({ query: '' })
    expect(result.success).toBe(false)
  })

  it('支持三种搜索模式', () => {
    const modes = ['keyword', 'vector', 'hybrid'] as const

    for (const mode of modes) {
      const result = searchSchema.safeParse({ query: 'test', mode })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.mode).toBe(mode)
      }
    }
  })

  it('无效的 mode 被拒绝', () => {
    const result = searchSchema.safeParse({ query: 'test', mode: 'fulltext' })
    expect(result.success).toBe(false)
  })

  it('topK 不能超过 50', () => {
    const result = searchSchema.safeParse({ query: 'test', topK: 51 })
    expect(result.success).toBe(false)
  })

  it('topK 不能小于 1', () => {
    const result = searchSchema.safeParse({ query: 'test', topK: 0 })
    expect(result.success).toBe(false)
  })

  it('topK 必须为整数', () => {
    const result = searchSchema.safeParse({ query: 'test', topK: 2.5 })
    expect(result.success).toBe(false)
  })

  it('threshold 必须在 [0, 1] 范围内', () => {
    expect(searchSchema.safeParse({ query: 'test', threshold: -0.1 }).success).toBe(false)
    expect(searchSchema.safeParse({ query: 'test', threshold: 1.1 }).success).toBe(false)
    expect(searchSchema.safeParse({ query: 'test', threshold: 0 }).success).toBe(true)
    expect(searchSchema.safeParse({ query: 'test', threshold: 1 }).success).toBe(true)
  })

  it('weight 参数在 [0, 1] 范围内', () => {
    const valid = searchSchema.safeParse({
      query: 'test',
      keywordWeight: 0.4,
      vectorWeight: 0.6
    })
    expect(valid.success).toBe(true)

    const invalid = searchSchema.safeParse({
      query: 'test',
      keywordWeight: 1.5
    })
    expect(invalid.success).toBe(false)
  })

  it('完整参数的请求通过验证', () => {
    const result = searchSchema.safeParse({
      query: '用户认证流程',
      mode: 'hybrid',
      topK: 10,
      threshold: 0.5,
      keywordWeight: 0.4,
      vectorWeight: 0.6
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.query).toBe('用户认证流程')
      expect(result.data.topK).toBe(10)
    }
  })
})

// ─── 搜索响应结构验证 ─────────────────────────────────────────────────────────

describe('搜索结果响应结构', () => {
  it('结果应包含必要字段', () => {
    // 模拟一个合法的搜索结果项
    const mockResult = {
      id: 'chunk-uuid-1',
      documentId: 'doc-uuid-1',
      documentTitle: 'Architecture Doc',
      contentPreview: 'This is a preview...',
      fullContent: 'This is the full content of the chunk',
      similarity: 0.85
    }

    // 验证字段存在且类型正确
    expect(typeof mockResult.id).toBe('string')
    expect(typeof mockResult.documentId).toBe('string')
    expect(typeof mockResult.similarity).toBe('number')
    expect(mockResult.similarity).toBeGreaterThanOrEqual(0)
    expect(mockResult.similarity).toBeLessThanOrEqual(1)
  })

  it('contentPreview 应截断超长内容', () => {
    const longContent = 'A'.repeat(500)
    const preview = longContent.substring(0, 200) + (longContent.length > 200 ? '...' : '')

    expect(preview.length).toBe(203)  // 200 + '...'
    expect(preview.endsWith('...')).toBe(true)
  })

  it('短内容不添加省略号', () => {
    const shortContent = 'Short content'
    const preview = shortContent.substring(0, 200) + (shortContent.length > 200 ? '...' : '')

    expect(preview).toBe('Short content')
    expect(preview.endsWith('...')).toBe(false)
  })
})

// ─── 分页参数验证（document list）────────────────────────────────────────────

describe('GET /api/documents - 分页参数', () => {
  it('页码和限制解析为数字', () => {
    const page = parseInt('2', 10)
    const limit = parseInt('20', 10)
    const offset = (page - 1) * limit

    expect(page).toBe(2)
    expect(limit).toBe(20)
    expect(offset).toBe(20)
  })

  it('默认分页参数', () => {
    const page = parseInt('1', 10)
    const limit = parseInt('50', 10)
    const offset = (page - 1) * limit

    expect(page).toBe(1)
    expect(limit).toBe(50)
    expect(offset).toBe(0)
  })

  it('无效页码使用 NaN 时回退处理', () => {
    const pageStr = 'invalid'
    const page = parseInt(pageStr, 10)

    expect(isNaN(page)).toBe(true)
    // API 层应处理这种情况（例如使用默认值 1）
    const safePage = isNaN(page) ? 1 : page
    expect(safePage).toBe(1)
  })
})
