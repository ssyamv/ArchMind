<script setup lang="ts">
defineProps<{ code: 404 | 403 | 500 }>()
</script>

<template>
  <div class="w-48 h-48 mx-auto">
    <!-- 404 - 页面不存在 -->
    <svg v-if="code === 404" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="currentColor" class="text-muted/10" />
      <text x="100" y="115" text-anchor="middle" font-size="56" font-weight="700" fill="currentColor" class="text-muted-foreground/40" font-family="system-ui">404</text>
      <!-- 放大镜 -->
      <circle cx="130" cy="130" r="22" stroke="currentColor" stroke-width="6" class="text-muted-foreground/50" />
      <line x1="147" y1="147" x2="165" y2="165" stroke="currentColor" stroke-width="6" stroke-linecap="round" class="text-muted-foreground/50" />
      <!-- 问号 -->
      <text x="130" y="137" text-anchor="middle" font-size="22" font-weight="700" fill="currentColor" class="text-muted-foreground/60" font-family="system-ui">?</text>
      <!-- 星星装饰 -->
      <circle cx="40" cy="50" r="4" fill="currentColor" class="text-primary/30" />
      <circle cx="165" cy="55" r="3" fill="currentColor" class="text-primary/20" />
      <circle cx="35" cy="155" r="3" fill="currentColor" class="text-primary/20" />
    </svg>

    <!-- 403 - 无权访问 -->
    <svg v-else-if="code === 403" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="currentColor" class="text-muted/10" />
      <!-- 锁主体 -->
      <rect x="62" y="95" width="76" height="60" rx="8" fill="currentColor" class="text-muted-foreground/40" />
      <!-- 锁扣 -->
      <path d="M72 95V78a28 28 0 0 1 56 0v17" stroke="currentColor" stroke-width="8" stroke-linecap="round" class="text-muted-foreground/50" fill="none" />
      <!-- 锁孔 -->
      <circle cx="100" cy="120" r="8" fill="currentColor" class="text-background/80" />
      <rect x="96" y="120" width="8" height="12" rx="2" fill="currentColor" class="text-background/80" />
      <!-- 禁止符号 -->
      <circle cx="148" cy="55" r="18" fill="currentColor" class="text-destructive/70" />
      <line x1="136" y1="43" x2="160" y2="67" stroke="white" stroke-width="4" stroke-linecap="round" />
    </svg>

    <!-- 500 - 服务器错误 -->
    <svg v-else viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="currentColor" class="text-muted/10" />
      <!-- 服务器外形 -->
      <rect x="50" y="55" width="100" height="35" rx="6" fill="currentColor" class="text-muted-foreground/35" />
      <rect x="50" y="98" width="100" height="35" rx="6" fill="currentColor" class="text-muted-foreground/35" />
      <rect x="50" y="141" width="100" height="22" rx="6" fill="currentColor" class="text-muted-foreground/35" />
      <!-- LED 指示灯 -->
      <circle cx="130" cy="72" r="5" fill="currentColor" class="text-destructive/80" />
      <circle cx="145" cy="72" r="5" fill="currentColor" class="text-muted-foreground/30" />
      <circle cx="130" cy="115" r="5" fill="currentColor" class="text-muted-foreground/30" />
      <circle cx="145" cy="115" r="5" fill="currentColor" class="text-muted-foreground/30" />
      <!-- 叹号 -->
      <circle cx="100" cy="72" r="10" fill="currentColor" class="text-destructive/20" />
      <text x="100" y="77" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor" class="text-destructive" font-family="system-ui">!</text>
      <!-- 闪电/报警 -->
      <path d="M100 25 L92 45 H100 L88 65 L108 38 H100 Z" fill="currentColor" class="text-yellow-500/60" />
    </svg>
  </div>
</template>
