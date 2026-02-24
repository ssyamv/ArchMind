/**
 * 全局客户端错误处理插件
 * 捕获未处理的 Vue 组件错误和 Promise rejection，通过 Toast 提示用户
 */

import { useToast } from '~/components/ui/toast'

export default defineNuxtPlugin((nuxtApp) => {
  const { toast } = useToast()

  // 捕获 Vue 组件内部未处理的错误
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    console.error('[Vue Error]', { error, info })

    // 忽略导航取消等非关键错误
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('navigation cancelled') || msg.includes('navigation aborted')) {
        return
      }
    }

    // 使用 Toast 通知用户
    try {
      toast({
        title: '应用发生错误',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
        duration: 3000
      })
    } catch {
      // Toast 本身出错时静默处理
    }
  }

  // 捕获未处理的 Promise rejection（仅客户端）
  if (import.meta.client) {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      console.error('[Unhandled Rejection]', reason)

      // 忽略 fetch 取消错误
      if (reason?.name === 'AbortError') return

      try {
        const message = reason instanceof Error
          ? reason.message
          : (typeof reason === 'string' ? reason : '异步操作失败')

        toast({
          title: '请求失败',
          description: message,
          variant: 'destructive',
          duration: 3000
        })
      } catch {
        // 静默处理
      }
    })
  }
})
