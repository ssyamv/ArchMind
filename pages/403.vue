<script setup lang="ts">
// 403 专用页面：前端接收到 API 403 响应时跳转此页
// 使用 navigateTo('/403') 跳转

definePageMeta({
  layout: false,
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-6">
    <div class="max-w-md w-full text-center space-y-8">
      <ErrorIllustration :code="403" />

      <div class="text-7xl font-bold text-muted-foreground/20 select-none leading-none">
        403
      </div>

      <div class="space-y-2">
        <h1 class="text-2xl font-semibold text-foreground">
          没有访问权限
        </h1>
        <p class="text-muted-foreground text-sm leading-relaxed">
          你没有权限访问此资源，请联系工作区管理员获取授权
        </p>
      </div>

      <ErrorActions :code="403" href="/app" action-label="返回工作区" />
    </div>
  </div>
</template>
