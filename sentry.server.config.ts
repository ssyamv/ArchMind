/**
 * Sentry 服务端初始化
 *
 * 在 Node.js/Nitro 服务端捕获：
 * - API 路由未处理异常
 * - 服务端渲染错误
 *
 * 每条 Sentry 事件会携带 reqId 标签，
 * 与 pino 日志的 reqId 字段对应，方便跨系统关联排查。
 *
 * 仅在 SENTRY_DSN 配置时启用，本地开发默认关闭。
 */

import * as Sentry from '@sentry/nuxt'

const dsn = process.env.SENTRY_DSN

// 未配置 DSN 时跳过初始化（本地开发默认不采集）
if (dsn) {
  Sentry.init({
    dsn,

    environment: process.env.NODE_ENV || 'production',

    // 服务端追踪采样率（监控 API 性能）
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // 全局过滤：只上报真正的服务端错误，过滤 4xx 客户端错误
    beforeSend (event, hint) {
      const error = hint.originalException

      // 过滤 H3Error（Nitro 的 HTTP 错误），只上报 5xx
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const statusCode = (error as { statusCode: number }).statusCode
        if (statusCode < 500) return null
      }

      return event
    }
  })
}
