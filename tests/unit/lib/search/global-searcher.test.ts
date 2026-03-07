/**
 * #70 全局搜索引擎 - extractSnippet 单元测试
 */

import { describe, it, expect } from 'vitest'

// 从 GlobalSearcher 中提取的 extractSnippet 方法逻辑（纯函数测试）
function extractSnippet (content: string | null, query: string): string | null {
  if (!content) return null
  const idx = content.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, 100)
  const start = Math.max(0, idx - 30)
  const end = Math.min(content.length, idx + 70)
  return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')
}

describe('GlobalSearcher extractSnippet', () => {
  it('返回 null 当 content 为 null', () => {
    expect(extractSnippet(null, 'test')).toBeNull()
  })

  it('无命中时返回前 100 字', () => {
    const content = 'A'.repeat(200)
    const result = extractSnippet(content, 'notexist')
    expect(result).toHaveLength(100)
  })

  it('命中词在文本开头', () => {
    const content = 'Hello World 这是一段测试内容'
    const result = extractSnippet(content, 'Hello')
    expect(result).toContain('Hello')
    expect(result!.startsWith('...')).toBe(false)
  })

  it('命中词在文本中间时带省略号', () => {
    const prefix = 'A'.repeat(50)
    const suffix = 'B'.repeat(100)
    const content = `${prefix}KEYWORD${suffix}`
    const result = extractSnippet(content, 'KEYWORD')
    expect(result).toContain('KEYWORD')
    expect(result!.startsWith('...')).toBe(true)
    expect(result!.endsWith('...')).toBe(true)
  })

  it('大小写不敏感', () => {
    const content = 'This is a Test Document'
    const result = extractSnippet(content, 'test')
    expect(result).toContain('Test')
  })

  it('短文本不带省略号', () => {
    const content = '短内容含测试'
    const result = extractSnippet(content, '测试')
    expect(result).toBe('短内容含测试')
    expect(result!.includes('...')).toBe(false)
  })
})
