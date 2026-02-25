/**
 * Rate Limiting 中间件
 * 使用内存 Map 实现 IP + 路径级别的请求频率限制
 *
 * 策略：
 * - 敏感认证端点（登录/注册/密码重置）：10 次/分钟
 * - AI 生成端点（PRD/原型/聊天流式生成、头像生成）：20 次/分钟
 * - 其他 API：120 次/分钟
 */

interface RateLimitEntry {
  count: number
  windowStart: number
  windowMs: number
}

// 内存存储：key = `${ip}:${path}`, value = { count, windowStart, windowMs }
const rateLimitStore = new Map<string, RateLimitEntry>()

// 定义各端点的限流规则（按匹配优先级排列，第一个匹配的生效）
export const RATE_LIMIT_RULES: Array<{
  pattern: RegExp
  maxRequests: number
  windowMs: number
}> = [
  // 敏感认证端点：10 次/分钟
  {
    pattern: /^\/api\/v1\/auth\/(login|register|forgot-password|reset-password)$/,
    maxRequests: 10,
    windowMs: 60 * 1000
  },
  // AI 生成端点（耗时且耗费资源）：20 次/分钟
  {
    pattern: /^\/api\/v1\/(prd\/stream|prototypes\/stream|chat\/stream|prototypes\/generate-from-prd|logic-maps\/generate-from-prd|user\/avatar\/generate)$/,
    maxRequests: 20,
    windowMs: 60 * 1000
  },
  // 其他 API：每分钟 120 次
  {
    pattern: /^\/api\/v1\//,
    maxRequests: 120,
    windowMs: 60 * 1000
  }
]

// 定期清理过期条目（每 5 分钟）
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

export function cleanupExpiredEntries () {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > entry.windowMs) {
      rateLimitStore.delete(key)
    }
  }
}

export function getClientIp (event: any): string {
  // 尝试从代理头获取真实 IP
  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = getHeader(event, 'x-real-ip')
  if (realIp) return realIp

  return event.node.req.socket?.remoteAddress || 'unknown'
}

export function checkRateLimit (ip: string, path: string, now: number): {
  allowed: boolean
  retryAfter?: number
  limit?: number
  remaining?: number
  reset?: number
} {
  const rule = RATE_LIMIT_RULES.find(r => r.pattern.test(path))
  if (!rule) return { allowed: true }

  const key = `${ip}:${path}`
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart > rule.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now, windowMs: rule.windowMs })
    return {
      allowed: true,
      limit: rule.maxRequests,
      remaining: rule.maxRequests - 1,
      reset: Math.ceil((now + rule.windowMs) / 1000)
    }
  }

  entry.count++

  if (entry.count > rule.maxRequests) {
    const retryAfter = Math.ceil((rule.windowMs - (now - entry.windowStart)) / 1000)
    return {
      allowed: false,
      retryAfter,
      limit: rule.maxRequests,
      remaining: 0,
      reset: Math.ceil((entry.windowStart + rule.windowMs) / 1000)
    }
  }

  return {
    allowed: true,
    limit: rule.maxRequests,
    remaining: rule.maxRequests - entry.count,
    reset: Math.ceil((entry.windowStart + rule.windowMs) / 1000)
  }
}

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''
  const method = event.node.req.method || 'GET'

  // 只对 API v1 路由进行限流，跳过静态资源和 Nuxt 内部路由
  if (!url.startsWith('/api/v1/')) return

  // 跳过 OPTIONS 预检请求
  if (method === 'OPTIONS') return

  // 定期清理过期条目
  const now = Date.now()
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanupExpiredEntries()
    lastCleanup = now
  }

  // 去掉 query string，只匹配路径
  const path = url.split('?')[0]
  const ip = getClientIp(event)
  const result = checkRateLimit(ip, path, now)

  if (!result.allowed) {
    setResponseHeaders(event, {
      'Retry-After': String(result.retryAfter),
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(result.reset)
    })
    throw createError({
      statusCode: 429,
      message: `请求过于频繁，请 ${result.retryAfter} 秒后重试`
    })
  }

  // 添加限流信息响应头
  setResponseHeaders(event, {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset)
  })
})
