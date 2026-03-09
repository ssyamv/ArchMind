/**
 * 移动端断点检测 Composable
 * 监听 sm 断点（< 640px），实时响应窗口尺寸变化
 */

import { ref, onMounted, onUnmounted } from 'vue'

export function useMobile() {
  const isMobile = ref(false)
  let mq: MediaQueryList | null = null

  function onChange(e: MediaQueryListEvent) {
    isMobile.value = e.matches
  }

  onMounted(() => {
    mq = window.matchMedia('(max-width: 639px)')
    isMobile.value = mq.matches
    mq.addEventListener('change', onChange)
  })

  onUnmounted(() => {
    mq?.removeEventListener('change', onChange)
  })

  return { isMobile }
}
