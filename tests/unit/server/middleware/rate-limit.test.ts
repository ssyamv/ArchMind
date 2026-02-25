/**
 * Rate Limiting 中间件单元测试
 * 只测试导出的纯逻辑函数，不依赖 H3/Nuxt 运行时
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// H3/Nuxt 全局函数在单测环境不存在，需要在模块加载前注入
// vi.stubGlobal 需要在模块导入前执行，使用 vi.hoisted 确保提升
const { defineEventHandlerMock } = vi.hoisted(() => {
  return { defineEventHandlerMock: (fn: (...args: unknown[]) => unknown) => fn }
})

const getHeaderMock = vi.hoisted(() => vi.fn())
const setResponseHeadersMock = vi.hoisted(() => vi.fn())

vi.stubGlobal('defineEventHandler', defineEventHandlerMock)
vi.stubGlobal('getHeader', getHeaderMock)
vi.stubGlobal('setResponseHeaders', setResponseHeadersMock)
vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number; message: string }) => {
  const err = new Error(message) as any
  err.statusCode = statusCode
  return err
})

// 使用动态导入确保 globals 在模块加载前已注入
let RATE_LIMIT_RULES: any[]
let checkRateLimit: (ip: string, path: string, now: number) => any
let cleanupExpiredEntries: () => void
let getClientIp: (event: any) => string
let rateLimitMiddleware: (event: any) => any

beforeAll(async () => {
  const mod = await import('~/server/middleware/02.rate-limit')
  RATE_LIMIT_RULES = mod.RATE_LIMIT_RULES
  checkRateLimit = mod.checkRateLimit
  cleanupExpiredEntries = mod.cleanupExpiredEntries
  getClientIp = mod.getClientIp
  rateLimitMiddleware = mod.default as any
})

// ─── RATE_LIMIT_RULES 规则定义 ────────────────────────────────────────────────

describe('RATE_LIMIT_RULES 规则定义', () => {
  it('认证端点规则匹配 login，限制 10 次/分钟', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/auth/login'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(10)
  })

  it('认证端点规则匹配 register', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/auth/register'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(10)
  })

  it('认证端点规则匹配 forgot-password', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/auth/forgot-password'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(10)
  })

  it('认证端点规则匹配 reset-password', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/auth/reset-password'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(10)
  })

  it('AI 生成端点规则匹配 prd/stream，限制 20 次/分钟', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/prd/stream'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(20)
  })

  it('AI 生成端点规则匹配 prototypes/stream', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/prototypes/stream'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(20)
  })

  it('AI 生成端点规则匹配 chat/stream', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/chat/stream'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(20)
  })

  it('AI 生成端点规则匹配 user/avatar/generate', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/user/avatar/generate'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(20)
  })

  it('其他 API 端点使用通用规则（120 次/分钟）', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/prd'))
    expect(rule).toBeDefined()
    expect(rule.maxRequests).toBe(120)
  })

  it('非 API 路径不匹配任何规则', () => {
    const rule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/static/logo.png'))
    expect(rule).toBeUndefined()
  })

  it('认证路径优先匹配认证规则（取第一个匹配），限制为 10 次/分钟', () => {
    // 使用 find 取第一个匹配（与 checkRateLimit 行为一致）
    const firstMatchedRule = RATE_LIMIT_RULES.find((r: any) => r.pattern.test('/api/v1/auth/login'))
    expect(firstMatchedRule).toBeDefined()
    expect(firstMatchedRule.maxRequests).toBe(10) // 认证规则优先，而非通用的 120 次
  })
})

// ─── checkRateLimit 限流逻辑 ──────────────────────────────────────────────────

describe('checkRateLimit 限流逻辑', () => {
  // 每个测试使用唯一 IP 避免模块级 Map 状态污染
  let ipSuffix = 0
  const nextIp = () => `10.${Math.floor(ipSuffix / 65536)}.${Math.floor(ipSuffix / 256) % 256}.${++ipSuffix % 256}`

  it('首次请求应被允许，remaining = limit - 1', () => {
    const now = Date.now()
    const result = checkRateLimit(nextIp(), '/api/v1/auth/login', now)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(9)
  })

  it('第 limit 次请求仍被允许，remaining = 0', () => {
    const ip = nextIp()
    const now = Date.now()

    for (let i = 0; i < 9; i++) {
      checkRateLimit(ip, '/api/v1/auth/login', now)
    }
    const result = checkRateLimit(ip, '/api/v1/auth/login', now)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('超出 limit 的请求被拒绝，返回 retryAfter', () => {
    const ip = nextIp()
    const now = Date.now()

    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, '/api/v1/auth/login', now)
    }

    const result = checkRateLimit(ip, '/api/v1/auth/login', now)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(60)
  })

  it('窗口期过后请求计数重置', () => {
    const ip = nextIp()
    const now = Date.now()
    const windowMs = 60 * 1000

    for (let i = 0; i < 11; i++) {
      checkRateLimit(ip, '/api/v1/auth/login', now)
    }
    expect(checkRateLimit(ip, '/api/v1/auth/login', now).allowed).toBe(false)

    // 模拟窗口过期
    const futureNow = now + windowMs + 1
    const result = checkRateLimit(ip, '/api/v1/auth/login', futureNow)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })

  it('不同 IP 的限流计数相互独立', () => {
    const ip1 = nextIp()
    const ip2 = nextIp()
    const now = Date.now()

    for (let i = 0; i < 11; i++) {
      checkRateLimit(ip1, '/api/v1/auth/login', now)
    }
    expect(checkRateLimit(ip1, '/api/v1/auth/login', now).allowed).toBe(false)
    expect(checkRateLimit(ip2, '/api/v1/auth/login', now).allowed).toBe(true)
  })

  it('同一 IP 不同路径计数相互独立', () => {
    const ip = nextIp()
    const now = Date.now()

    for (let i = 0; i < 11; i++) {
      checkRateLimit(ip, '/api/v1/auth/login', now)
    }
    expect(checkRateLimit(ip, '/api/v1/auth/login', now).allowed).toBe(false)
    // register 是独立 key，不受 login 影响
    expect(checkRateLimit(ip, '/api/v1/auth/register', now).allowed).toBe(true)
  })

  it('非 API 路径不受限流限制', () => {
    const now = Date.now()
    const result = checkRateLimit(nextIp(), '/static/logo.png', now)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBeUndefined()
  })

  it('返回的 reset 时间戳在未来', () => {
    const now = Date.now()
    const result = checkRateLimit(nextIp(), '/api/v1/auth/login', now)
    expect(result.reset).toBeGreaterThan(Math.floor(now / 1000))
  })

  it('AI 端点限制为 20 次/分钟', () => {
    const ip = nextIp()
    const now = Date.now()

    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(ip, '/api/v1/prd/stream', now).allowed).toBe(true)
    }
    // 第 21 次被拒绝
    expect(checkRateLimit(ip, '/api/v1/prd/stream', now).allowed).toBe(false)
  })
})

// ─── cleanupExpiredEntries ────────────────────────────────────────────────────

describe('cleanupExpiredEntries', () => {
  it('执行不抛出错误', () => {
    expect(() => cleanupExpiredEntries()).not.toThrow()
  })

  it('当前窗口内条目清理后状态不变', () => {
    const ip = '172.31.0.99'
    const now = Date.now()

    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, '/api/v1/auth/login', now)
    }
    expect(checkRateLimit(ip, '/api/v1/auth/login', now).allowed).toBe(false)

    // 清理（当前窗口未过期，条目应被保留）
    cleanupExpiredEntries()

    // 状态不变
    expect(checkRateLimit(ip, '/api/v1/auth/login', now).allowed).toBe(false)
  })
})

// ─── getClientIp ──────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  beforeEach(() => {
    getHeaderMock.mockReset()
  })

  it('x-forwarded-for 存在时取第一个 IP', () => {
    getHeaderMock.mockImplementation((_event: any, header: string) => {
      if (header === 'x-forwarded-for') return '1.2.3.4, 5.6.7.8'
      return undefined
    })
    const event = { node: { req: { socket: { remoteAddress: '127.0.0.1' } } } }
    expect(getClientIp(event)).toBe('1.2.3.4')
  })

  it('无 x-forwarded-for 时使用 x-real-ip', () => {
    getHeaderMock.mockImplementation((_event: any, header: string) => {
      if (header === 'x-forwarded-for') return undefined
      if (header === 'x-real-ip') return '10.0.0.1'
      return undefined
    })
    const event = { node: { req: { socket: { remoteAddress: '127.0.0.1' } } } }
    expect(getClientIp(event)).toBe('10.0.0.1')
  })

  it('无代理头时使用 socket.remoteAddress', () => {
    getHeaderMock.mockReturnValue(undefined)
    const event = { node: { req: { socket: { remoteAddress: '192.168.1.100' } } } }
    expect(getClientIp(event)).toBe('192.168.1.100')
  })

  it('socket 不存在时返回 unknown', () => {
    getHeaderMock.mockReturnValue(undefined)
    const event = { node: { req: { socket: undefined } } }
    expect(getClientIp(event)).toBe('unknown')
  })

  it('x-forwarded-for 多个 IP 用逗号分隔时取第一个并去除空格', () => {
    getHeaderMock.mockImplementation((_event: any, header: string) => {
      if (header === 'x-forwarded-for') return '  203.0.113.1  , 198.51.100.2'
      return undefined
    })
    const event = { node: { req: { socket: {} } } }
    expect(getClientIp(event)).toBe('203.0.113.1')
  })
})

// ─── 中间件 defineEventHandler 行为 ──────────────────────────────────────────

describe('rate-limit middleware 行为', () => {
  function makeEvent (url: string, method = 'GET') {
    return {
      node: {
        req: {
          url,
          method,
          socket: { remoteAddress: '127.0.0.1' }
        }
      }
    }
  }

  beforeEach(() => {
    setResponseHeadersMock.mockReset()
    getHeaderMock.mockReturnValue(undefined)
  })

  it('非 API 路由直接返回（不限流）', () => {
    const event = makeEvent('/static/logo.png')
    const result = rateLimitMiddleware(event)
    expect(result).toBeUndefined()
    expect(setResponseHeadersMock).not.toHaveBeenCalled()
  })

  it('OPTIONS 预检请求直接返回', () => {
    const event = makeEvent('/api/v1/auth/login', 'OPTIONS')
    const result = rateLimitMiddleware(event)
    expect(result).toBeUndefined()
    expect(setResponseHeadersMock).not.toHaveBeenCalled()
  })

  it('正常 API 请求设置 X-RateLimit 响应头', () => {
    const event = makeEvent('/api/v1/documents')
    rateLimitMiddleware(event)
    expect(setResponseHeadersMock).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        'X-RateLimit-Limit': expect.any(String),
        'X-RateLimit-Remaining': expect.any(String),
        'X-RateLimit-Reset': expect.any(String)
      })
    )
  })

  it('query string 去除后只匹配路径', () => {
    const event = makeEvent('/api/v1/auth/login?redirect=/dashboard')
    // login 受 10 次/分钟限制，传入带参的 URL 应该正常走限流
    rateLimitMiddleware(event)
    expect(setResponseHeadersMock).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ 'X-RateLimit-Limit': '10' })
    )
  })

  it('超出限制时抛出 429 错误并设置 Retry-After 响应头', () => {
    const ip = '172.20.1.1'
    getHeaderMock.mockImplementation((_e: any, header: string) => {
      if (header === 'x-forwarded-for') return ip
      return undefined
    })

    const now = Date.now()
    // 先直接用 checkRateLimit 耗尽额度
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, '/api/v1/auth/login', now)
    }

    const event = makeEvent('/api/v1/auth/login')
    expect(() => rateLimitMiddleware(event)).toThrow()
    expect(setResponseHeadersMock).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        'Retry-After': expect.any(String),
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '0'
      })
    )
  })
})
