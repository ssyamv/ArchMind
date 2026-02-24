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
export const CSRF_EXEMPT_PATHS = [
  '/api/health',
  '/api/share/'  // 公开分享端点
]

export function isExemptPath (path: string): boolean {
  return CSRF_EXEMPT_PATHS.some(prefix => path.startsWith(prefix))
}

export function getOriginHost (url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

/**
 * 校验 CSRF 来源
 * @returns null 表示通过，string 表示拒绝原因
 */
export function validateCsrfOrigin (params: {
  method: string
  path: string
  requestHost: string | undefined
  origin: string | undefined
  referer: string | undefined
  isDev: boolean
}): string | null {
  const { method, path, requestHost, origin, referer, isDev } = params

  // GET/HEAD/OPTIONS 无需 CSRF 保护
  if (SAFE_METHODS.has(method)) return null

  // 只保护 API 路由
  if (!path.startsWith('/api/')) return null

  // 豁免路径
  if (isExemptPath(path)) return null

  // 开发模式放宽限制（允许 localhost）
  if (isDev) return null

  // 获取请求的 Host
  if (!requestHost) return '请求缺少 Host 头'

  // 检查 Origin 头
  if (origin) {
    const originHost = getOriginHost(origin)
    if (!originHost || originHost !== requestHost) {
      return 'CSRF 验证失败：Origin 不匹配'
    }
    return null // Origin 匹配，通过
  }

  // 没有 Origin 头时，检查 Referer 头
  if (referer) {
    const refererHost = getOriginHost(referer)
    if (!refererHost || refererHost !== requestHost) {
      return 'CSRF 验证失败：Referer 不匹配'
    }
    return null // Referer 匹配，通过
  }

  // 既没有 Origin 也没有 Referer，拒绝（仅生产环境）
  return 'CSRF 验证失败：缺少来源信息'
}

export default defineEventHandler((event) => {
  const method = event.node.req.method || 'GET'
  const url = event.node.req.url || ''
  const path = url.split('?')[0]

  const errorMessage = validateCsrfOrigin({
    method,
    path,
    requestHost: getHeader(event, 'host') || undefined,
    origin: getHeader(event, 'origin') || undefined,
    referer: getHeader(event, 'referer') || undefined,
    isDev: process.env.NODE_ENV !== 'production'
  })

  if (errorMessage) {
    throw createError({ statusCode: 403, message: errorMessage })
  }
})
