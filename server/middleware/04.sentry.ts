/**
 * Sentry 请求上下文中间件
 *
 * 编号 04，确保在 00.logger.ts 注入 reqId 之后执行。
 *
 * 为每个请求创建独立的 Sentry scope，注入以下标签：
 * - reqId: 与 pino 日志的 reqId 一致，方便在 Sentry 中关联日志
 * - userId: 认证用户 ID（如已认证）
 * - url: 请求路径
 * - method: HTTP 方法
 *
 * 这样在 Sentry 事件详情中可以通过 reqId 快速定位对应的服务端日志。
 */

import * as Sentry from '@sentry/nuxt'

export default defineEventHandler((event) => {
  // 未初始化 Sentry 时跳过（本地开发）
  if (!process.env.SENTRY_DSN) return

  const url = event.node.req.url || ''

  // 只处理 API 路由
  if (!url.startsWith('/api/')) return

  const reqId = event.context.reqId as string | undefined
  const method = event.node.req.method || 'GET'
  const [path] = url.split('?')

  // 为本次请求设置 Sentry scope 上下文
  Sentry.withScope((scope) => {
    if (reqId) {
      scope.setTag('req_id', reqId)
    }
    scope.setTag('http.method', method)
    scope.setTag('http.url', path)
  })
})
