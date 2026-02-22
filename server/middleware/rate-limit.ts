/**
 * Rate Limiting 中间件
 * 使用内存 Map 实现 IP + 路径级别的请求频率限制
 *
 * 策略：
 * - 普通 API：60 次/分钟
 * - 敏感端点（登录/注册/密码重置）：10 次/分钟
 * - AI 生成端点（流式）：20 次/分钟
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

// 内存存储：key = `${ip}:${route}`, value = { count, windowStart }
const rateLimitStore = new Map<string, RateLimitEntry>()

// 定义各端点的限流规则
const RATE_LIMIT_RULES: Array<{
  pattern: RegExp
  maxRequests: number
  windowMs: number
}> = [
  // 敏感认证端点：10 次/分钟
  {
    pattern: /^\/api\/auth\/(login|register|forgot-password|reset-password)$/,
    maxRequests: 10,
    windowMs: 60 * 1000
  },
  // AI 生成端点（耗时且耗费资源）：20 次/分钟
  {
    pattern: /^\/api\/(prd\/stream|prototypes\/stream|chat\/stream|assets\/generate|user\/avatar\/generate)$/,
    maxRequests: 20,
    windowMs: 60 * 1000
  },
  // 其他 API：每分钟 120 次
  {
    pattern: /^\/api\//,
    maxRequests: 120,
    windowMs: 60 * 1000
  }
]

// 定期清理过期条目（每 5 分钟）
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries (maxWindowMs: number) {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > maxWindowMs) {
      rateLimitStore.delete(key)
    }
  }
}

function getClientIp (event: any): string {
  // 尝试从代理头获取真实 IP
  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = getHeader(event, 'x-real-ip')
  if (realIp) return realIp

  return event.node.req.socket?.remoteAddress || 'unknown'
}

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''
  const method = event.node.req.method || 'GET'

  // 只对 API 路由进行限流，跳过静态资源和 Nuxt 内部路由
  if (!url.startsWith('/api/')) return

  // 只对写操作和查询操作限流（跳过 OPTIONS 预检）
  if (method === 'OPTIONS') return

  // 定期清理
  const now = Date.now()
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanupExpiredEntries(CLEANUP_INTERVAL)
    lastCleanup = now
  }

  // 去掉 query string，只匹配路径
  const path = url.split('?')[0]

  // 匹配限流规则
  const rule = RATE_LIMIT_RULES.find(r => r.pattern.test(path))
  if (!rule) return

  const ip = getClientIp(event)
  const key = `${ip}:${path}`
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart > rule.windowMs) {
    // 新窗口
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return
  }

  entry.count++

  if (entry.count > rule.maxRequests) {
    const retryAfter = Math.ceil((rule.windowMs - (now - entry.windowStart)) / 1000)
    setResponseHeaders(event, {
      'Retry-After': String(retryAfter),
      'X-RateLimit-Limit': String(rule.maxRequests),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil((entry.windowStart + rule.windowMs) / 1000))
    })
    throw createError({
      statusCode: 429,
      message: `请求过于频繁，请 ${retryAfter} 秒后重试`
    })
  }

  // 添加限流信息响应头
  setResponseHeaders(event, {
    'X-RateLimit-Limit': String(rule.maxRequests),
    'X-RateLimit-Remaining': String(rule.maxRequests - entry.count),
    'X-RateLimit-Reset': String(Math.ceil((entry.windowStart + rule.windowMs) / 1000))
  })
})
