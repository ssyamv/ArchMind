/**
 * CSRF 保护中间件
 *
 * 项目采用 HTTP-Only Cookie + JWT 方案，Cookie 已设置 SameSite=lax
 * 可有效阻止大多数跨站请求。
 *
 * 此中间件作为额外防护层：
 * - 对写操作（POST/PUT/PATCH/DELETE）校验请求来源（Origin/Referer）
 * - 开发模式下放宽限制
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// 跳过 CSRF 检查的路径前缀（如公开的 webhook、健康检查）
const CSRF_EXEMPT_PATHS = [
  '/api/health',
  '/api/share/'  // 公开分享端点
]

function isExemptPath (path: string): boolean {
  return CSRF_EXEMPT_PATHS.some(prefix => path.startsWith(prefix))
}

function getOriginHost (url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

export default defineEventHandler((event) => {
  const method = event.node.req.method || 'GET'
  const url = event.node.req.url || ''

  // GET/HEAD/OPTIONS 无需 CSRF 保护
  if (SAFE_METHODS.has(method)) return

  // 只保护 API 路由
  if (!url.startsWith('/api/')) return

  // 豁免路径
  const path = url.split('?')[0]
  if (isExemptPath(path)) return

  // 开发模式放宽限制（允许 localhost）
  const isDev = process.env.NODE_ENV !== 'production'
  if (isDev) return

  // 获取请求的 Host（服务端期望的 Host）
  const requestHost = getHeader(event, 'host')
  if (!requestHost) {
    throw createError({ statusCode: 403, message: '请求缺少 Host 头' })
  }

  // 检查 Origin 头
  const origin = getHeader(event, 'origin')
  if (origin) {
    const originHost = getOriginHost(origin)
    if (!originHost || originHost !== requestHost) {
      throw createError({
        statusCode: 403,
        message: 'CSRF 验证失败：Origin 不匹配'
      })
    }
    return // Origin 匹配，通过
  }

  // 没有 Origin 头时，检查 Referer 头
  const referer = getHeader(event, 'referer')
  if (referer) {
    const refererHost = getOriginHost(referer)
    if (!refererHost || refererHost !== requestHost) {
      throw createError({
        statusCode: 403,
        message: 'CSRF 验证失败：Referer 不匹配'
      })
    }
    return // Referer 匹配，通过
  }

  // 既没有 Origin 也没有 Referer，拒绝（仅生产环境）
  throw createError({
    statusCode: 403,
    message: 'CSRF 验证失败：缺少来源信息'
  })
})
