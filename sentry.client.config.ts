/**
 * Sentry 客户端初始化
 *
 * 在浏览器端捕获：
 * - Vue 组件错误（通过 Sentry Vue 集成自动捕获）
 * - 未处理的 Promise rejection
 * - 网络请求异常
 *
 * 仅在 SENTRY_DSN 配置时启用，本地开发默认关闭。
 * DSN 通过 Nuxt runtimeConfig.public.sentryDsn 注入。
 */

import * as Sentry from '@sentry/nuxt'

const runtimeConfig = useRuntimeConfig()
const dsn = runtimeConfig.public.sentryDsn as string | undefined

// 未配置 DSN 时跳过初始化（本地开发默认不采集）
if (dsn) {
  Sentry.init({
    dsn,

    environment: runtimeConfig.public.appEnv as string || 'production',

    // 追踪采样率：生产环境 0.1，开发环境 1.0
    tracesSampleRate: runtimeConfig.public.appEnv === 'development' ? 1.0 : 0.1,

    // Session Replay：录制错误时的用户操作回放
    integrations: [
      Sentry.replayIntegration({
        // 屏蔽所有输入框内容（防止敏感信息泄露）
        maskAllInputs: true,
        blockAllMedia: false
      })
    ],

    // 正常会话 1% 采样，报错会话 100% 采样
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    // 过滤掉浏览器插件、第三方脚本引起的噪音错误
    ignoreErrors: [
      'chrome-extension://',
      'moz-extension://',
      'NetworkError',
      'Failed to fetch',
      'ResizeObserver loop'
    ]
  })
}
