/**
 * HTTP 请求日志中间件
 *
 * 编号 00，确保在所有其他中间件之前执行。
 * 记录每个 API 请求的完整生命周期：
 *   - 请求进入：method、path、IP、userId（认证后）
 *   - 请求完成：statusCode、duration
 *   - 请求异常：error 信息
 *
 * 日志字段说明：
 *   reqId    - 请求唯一 ID（用于关联同一请求的所有日志）
 *   method   - HTTP 方法
 *   path     - 请求路径（不含 query string）
 *   query    - query string（仅 debug 级别）
 *   ip       - 客户端真实 IP
 *   ua       - User-Agent
 *   userId   - 认证用户 ID（认证后注入）
 *   status   - HTTP 响应状态码
 *   duration - 请求处理耗时（毫秒）
 */

import { logger } from '~/server/utils/logger'
import { nanoid } from 'nanoid'

function getClientIp(event: any): string {
  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = getHeader(event, 'x-real-ip')
  if (realIp) return realIp
  return event.node.req.socket?.remoteAddress || 'unknown'
}

export default defineEventHandler((event) => {
  const url = event.node.req.url || ''

  // 只记录 API 路由，跳过静态资源、Nuxt 内部路由
  if (!url.startsWith('/api/')) return

  const method = event.node.req.method || 'GET'

  // 跳过 OPTIONS 预检请求
  if (method === 'OPTIONS') return

  const [path, queryString] = url.split('?')
  const reqId = nanoid(12)
  const startTime = Date.now()
  const ip = getClientIp(event)
  const ua = getHeader(event, 'user-agent') || ''

  // 注入 reqId 到 event.context，供下游中间件和 API 路由使用
  event.context.reqId = reqId

  // 记录请求进入（debug 级别，生产环境不输出避免日志量过大）
  logger.debug({
    reqId,
    method,
    path,
    query: queryString || undefined,
    ip,
    ua,
  }, 'request received')

  // 监听响应完成事件，记录请求结果
  event.node.res.on('finish', () => {
    const status = event.node.res.statusCode
    const duration = Date.now() - startTime
    // 认证中间件在本中间件之后执行，finish 时 userId 已注入
    const userId = event.context.userId

    const logData = {
      reqId,
      method,
      path,
      status,
      duration,
      ip,
      ...(userId ? { userId } : {}),
    }

    if (status >= 500) {
      logger.error(logData, 'request error')
    } else if (status >= 400) {
      logger.warn(logData, 'request failed')
    } else {
      logger.info(logData, 'request completed')
    }
  })
})
