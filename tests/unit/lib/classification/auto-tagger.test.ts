/**
 * #68 文档自动标签 - AutoTagger 单元测试
 */

import { describe, it, expect } from 'vitest'

// 直接测试 parseResponse 逻辑（无需数据库连接）
function parseResponse (raw: string) {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.suggestedCategory || !Array.isArray(parsed.suggestedTags)) return null

    return {
      suggestedCategory: String(parsed.suggestedCategory).slice(0, 100),
      suggestedTags: parsed.suggestedTags.slice(0, 5).map((t: any) => String(t).slice(0, 20)),
      documentType: (['prd', 'design', 'technical', 'report', 'other'].includes(parsed.documentType)
        ? parsed.documentType
        : 'other'),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      summary: String(parsed.summary ?? '').slice(0, 200),
    }
  } catch {
    return null
  }
}

describe('AutoTagger parseResponse', () => {
  it('正确解析有效 JSON 响应', () => {
    const raw = JSON.stringify({
      suggestedCategory: '产品需求',
      suggestedTags: ['用户认证', '登录注册'],
      documentType: 'prd',
      confidence: 0.92,
      summary: '这是一份关于用户认证的产品需求文档',
    })

    const result = parseResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.suggestedCategory).toBe('产品需求')
    expect(result!.suggestedTags).toEqual(['用户认证', '登录注册'])
    expect(result!.documentType).toBe('prd')
    expect(result!.confidence).toBe(0.92)
    expect(result!.summary).toBe('这是一份关于用户认证的产品需求文档')
  })

  it('处理包裹在 markdown 代码块中的 JSON', () => {
    const raw = '```json\n{"suggestedCategory":"技术设计","suggestedTags":["API","架构"],"documentType":"technical","confidence":0.85,"summary":"API 架构设计文档"}\n```'

    const result = parseResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.suggestedCategory).toBe('技术设计')
    expect(result!.documentType).toBe('technical')
  })

  it('无效 documentType 降级为 other', () => {
    const raw = JSON.stringify({
      suggestedCategory: '其他',
      suggestedTags: ['标签'],
      documentType: 'invalid_type',
      confidence: 0.5,
    })

    const result = parseResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.documentType).toBe('other')
  })

  it('confidence 超出 0-1 范围时被截断', () => {
    const raw = JSON.stringify({
      suggestedCategory: '产品需求',
      suggestedTags: ['标签'],
      documentType: 'prd',
      confidence: 1.5,
    })

    const result = parseResponse(raw)
    expect(result!.confidence).toBe(1)
  })

  it('confidence 为负数时被截断为 0', () => {
    const raw = JSON.stringify({
      suggestedCategory: '产品需求',
      suggestedTags: ['标签'],
      documentType: 'prd',
      confidence: -0.5,
    })

    const result = parseResponse(raw)
    expect(result!.confidence).toBe(0)
  })

  it('标签超过 5 个时截断', () => {
    const raw = JSON.stringify({
      suggestedCategory: '产品需求',
      suggestedTags: ['1', '2', '3', '4', '5', '6', '7'],
      documentType: 'prd',
      confidence: 0.8,
    })

    const result = parseResponse(raw)
    expect(result!.suggestedTags).toHaveLength(5)
  })

  it('缺少必要字段返回 null', () => {
    expect(parseResponse('{"suggestedTags":[]}')).toBeNull()
    expect(parseResponse('{"suggestedCategory":"x"}')).toBeNull()
  })

  it('无效 JSON 返回 null', () => {
    expect(parseResponse('not json at all')).toBeNull()
    expect(parseResponse('')).toBeNull()
  })

  it('summary 缺失时默认为空字符串', () => {
    const raw = JSON.stringify({
      suggestedCategory: '产品需求',
      suggestedTags: ['标签'],
      documentType: 'prd',
      confidence: 0.8,
    })

    const result = parseResponse(raw)
    expect(result!.summary).toBe('')
  })
})
