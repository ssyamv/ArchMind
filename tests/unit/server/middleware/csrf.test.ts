/**
 * CSRF 保护中间件单元测试
 * 只测试导出的纯逻辑函数，不依赖 H3/Nuxt 运行时
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock H3 全局函数
vi.stubGlobal('defineEventHandler', (fn: (...args: unknown[]) => unknown) => fn)
vi.stubGlobal('getHeader', vi.fn())
vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number; message: string }) => {
  const err = new Error(message) as any
  err.statusCode = statusCode
  return err
})

let isExemptPath: (path: string) => boolean
let getOriginHost: (url: string) => string | null
let validateCsrfOrigin: (params: {
  method: string
  path: string
  requestHost: string | undefined
  origin: string | undefined
  referer: string | undefined
  isDev: boolean
}) => string | null

beforeAll(async () => {
  const mod = await import('~/server/middleware/03.csrf')
  isExemptPath = mod.isExemptPath
  getOriginHost = mod.getOriginHost
  validateCsrfOrigin = mod.validateCsrfOrigin
})

// ─── isExemptPath ─────────────────────────────────────────────────────────────

describe('isExemptPath', () => {
  it('/api/v1/health 路径豁免', () => {
    expect(isExemptPath('/api/v1/health')).toBe(true)
  })

  it('/api/v1/share/ 前缀路径豁免', () => {
    expect(isExemptPath('/api/v1/share/abc123')).toBe(true)
  })

  it('普通 API 路径不豁免', () => {
    expect(isExemptPath('/api/v1/prd')).toBe(false)
    expect(isExemptPath('/api/v1/auth/login')).toBe(false)
    expect(isExemptPath('/api/v1/documents')).toBe(false)
  })
})

// ─── getOriginHost ────────────────────────────────────────────────────────────

describe('getOriginHost', () => {
  it('返回有效 URL 的 host', () => {
    expect(getOriginHost('https://example.com')).toBe('example.com')
    expect(getOriginHost('https://arch-mind.vercel.app')).toBe('arch-mind.vercel.app')
    expect(getOriginHost('http://localhost:3000')).toBe('localhost:3000')
  })

  it('包含路径的 URL 只返回 host', () => {
    expect(getOriginHost('https://example.com/path/to/page')).toBe('example.com')
  })

  it('无效 URL 返回 null', () => {
    expect(getOriginHost('not-a-url')).toBeNull()
    expect(getOriginHost('')).toBeNull()
  })
})

// ─── validateCsrfOrigin ───────────────────────────────────────────────────────

describe('validateCsrfOrigin - 安全方法（GET/HEAD/OPTIONS）', () => {
  const baseParams = {
    path: '/api/v1/prd',
    requestHost: 'example.com',
    origin: undefined,
    referer: undefined,
    isDev: false
  }

  it('GET 请求直接通过，返回 null', () => {
    expect(validateCsrfOrigin({ ...baseParams, method: 'GET' })).toBeNull()
  })

  it('HEAD 请求直接通过', () => {
    expect(validateCsrfOrigin({ ...baseParams, method: 'HEAD' })).toBeNull()
  })

  it('OPTIONS 请求直接通过', () => {
    expect(validateCsrfOrigin({ ...baseParams, method: 'OPTIONS' })).toBeNull()
  })
})

describe('validateCsrfOrigin - 非 API 路径', () => {
  it('非 API 路径的 POST 请求不受 CSRF 保护', () => {
    const result = validateCsrfOrigin({
      method: 'POST',
      path: '/some-page',
      requestHost: 'example.com',
      origin: undefined,
      referer: undefined,
      isDev: false
    })
    expect(result).toBeNull()
  })
})

describe('validateCsrfOrigin - 豁免路径', () => {
  it('/api/v1/health POST 豁免', () => {
    const result = validateCsrfOrigin({
      method: 'POST',
      path: '/api/v1/health',
      requestHost: 'example.com',
      origin: 'https://evil.com',
      referer: undefined,
      isDev: false
    })
    expect(result).toBeNull()
  })

  it('/api/v1/share/* POST 豁免', () => {
    const result = validateCsrfOrigin({
      method: 'POST',
      path: '/api/v1/share/abc123',
      requestHost: 'example.com',
      origin: undefined,
      referer: undefined,
      isDev: false
    })
    expect(result).toBeNull()
  })
})

describe('validateCsrfOrigin - 开发模式', () => {
  it('开发模式下放行所有写操作', () => {
    const result = validateCsrfOrigin({
      method: 'POST',
      path: '/api/v1/prd',
      requestHost: 'localhost:3000',
      origin: undefined,
      referer: undefined,
      isDev: true
    })
    expect(result).toBeNull()
  })
})

describe('validateCsrfOrigin - 生产模式 Origin 校验', () => {
  const prodBase = {
    method: 'POST',
    path: '/api/v1/prd',
    requestHost: 'arch-mind.vercel.app',
    referer: undefined,
    isDev: false
  }

  it('Origin 与 Host 匹配时通过', () => {
    const result = validateCsrfOrigin({
      ...prodBase,
      origin: 'https://arch-mind.vercel.app'
    })
    expect(result).toBeNull()
  })

  it('Origin 与 Host 不匹配时拒绝', () => {
    const result = validateCsrfOrigin({
      ...prodBase,
      origin: 'https://evil.com'
    })
    expect(result).toBe('CSRF 验证失败：Origin 不匹配')
  })

  it('Origin 为无效 URL 时拒绝', () => {
    const result = validateCsrfOrigin({
      ...prodBase,
      origin: 'not-valid-url'
    })
    expect(result).toBe('CSRF 验证失败：Origin 不匹配')
  })

  it('POST/PUT/PATCH/DELETE 都受到保护', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const result = validateCsrfOrigin({
        method,
        path: '/api/v1/prd',
        requestHost: 'example.com',
        origin: 'https://evil.com',
        referer: undefined,
        isDev: false
      })
      expect(result).not.toBeNull()
    }
  })
})

describe('validateCsrfOrigin - 生产模式 Referer 回退', () => {
  const prodBase = {
    method: 'POST',
    path: '/api/v1/prd',
    requestHost: 'arch-mind.vercel.app',
    origin: undefined,
    isDev: false
  }

  it('无 Origin 时，Referer 与 Host 匹配通过', () => {
    const result = validateCsrfOrigin({
      ...prodBase,
      referer: 'https://arch-mind.vercel.app/app'
    })
    expect(result).toBeNull()
  })

  it('无 Origin 时，Referer 与 Host 不匹配拒绝', () => {
    const result = validateCsrfOrigin({
      ...prodBase,
      referer: 'https://evil.com/attack'
    })
    expect(result).toBe('CSRF 验证失败：Referer 不匹配')
  })

  it('既无 Origin 也无 Referer 时拒绝', () => {
    const result = validateCsrfOrigin({
      ...prodBase,
      referer: undefined
    })
    expect(result).toBe('CSRF 验证失败：缺少来源信息')
  })
})

describe('validateCsrfOrigin - 缺少 Host', () => {
  it('请求缺少 Host 头时拒绝（生产模式）', () => {
    const result = validateCsrfOrigin({
      method: 'POST',
      path: '/api/v1/prd',
      requestHost: undefined,
      origin: 'https://example.com',
      referer: undefined,
      isDev: false
    })
    expect(result).toBe('请求缺少 Host 头')
  })
})
