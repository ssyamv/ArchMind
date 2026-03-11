<script setup lang="ts">
const error = useError()
const statusCode = computed(() => error.value?.statusCode ?? 500)

const safeCode = computed((): 404 | 403 | 500 => {
  const code = statusCode.value
  if (code === 404) return 404
  if (code === 403) return 403
  return 500
})

const errorConfig = computed(() => {
  switch (statusCode.value) {
    case 404:
      return {
        title: '页面不存在',
        desc: '你访问的页面已被删除或从未存在过',
        action: '返回首页',
        href: '/app',
      }
    case 403:
      return {
        title: '没有访问权限',
        desc: '你没有权限访问此资源，请联系工作区管理员',
        action: '返回工作区',
        href: '/app',
      }
    default:
      return {
        title: '服务出现问题',
        desc: '服务暂时不可用，我们正在修复中，请稍后再试',
        action: '刷新重试',
        href: null,
      }
  }
})

// 500 时展示 reqId，便于用户联系支持
const reqId = computed(() => {
  const data = (error.value as any)?.data
  return data?.reqId ?? null
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-6">
    <div class="max-w-md w-full text-center space-y-8">
      <!-- SVG 插画 -->
      <ErrorIllustration :code="safeCode" />

      <!-- 错误码 -->
      <div class="text-7xl font-bold text-muted-foreground/20 select-none leading-none">
        {{ statusCode }}
      </div>

      <!-- 标题 & 描述 -->
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold text-foreground">
          {{ errorConfig.title }}
        </h1>
        <p class="text-muted-foreground text-sm leading-relaxed">
          {{ errorConfig.desc }}
        </p>
      </div>

      <!-- 500 错误时显示 reqId -->
      <div v-if="statusCode >= 500 && reqId" class="rounded-lg bg-muted/50 border border-border px-4 py-3 text-left space-y-1">
        <p class="text-xs font-medium text-muted-foreground">错误追踪 ID</p>
        <code class="text-xs font-mono text-foreground break-all">{{ reqId }}</code>
        <p class="text-xs text-muted-foreground">如问题持续存在，请截图此页面联系技术支持</p>
      </div>

      <!-- 操作按钮 -->
      <ErrorActions
        :code="safeCode"
        :href="errorConfig.href"
        :action-label="errorConfig.action"
      />
    </div>
  </div>
</template>
