<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20 text-center px-6">
    <!-- SVG 插画 -->
    <div class="w-32 h-32 mb-6 text-muted-foreground/30">
      <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- PRD 文档堆叠 -->
        <rect x="20" y="28" width="60" height="76" rx="6" fill="currentColor" opacity="0.1" />
        <rect x="28" y="20" width="60" height="76" rx="6" fill="currentColor" opacity="0.15" />
        <rect x="36" y="12" width="60" height="76" rx="6" fill="currentColor" opacity="0.2" />
        <!-- 文档内容线条 -->
        <rect x="48" y="28" width="36" height="4" rx="2" fill="currentColor" opacity="0.5" />
        <rect x="48" y="40" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.4" />
        <rect x="48" y="50" width="32" height="3" rx="1.5" fill="currentColor" opacity="0.4" />
        <rect x="48" y="60" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
        <!-- AI 闪光 -->
        <circle cx="100" cy="100" r="20" fill="currentColor" opacity="0.08" />
        <path d="M100 88 L103 96 L111 96 L105 102 L107 110 L100 106 L93 110 L95 102 L89 96 L97 96 Z" fill="currentColor" opacity="0.5" />
      </svg>
    </div>

    <h3 class="text-lg font-semibold mb-2 text-foreground">还没有 PRD？</h3>
    <p class="text-sm text-muted-foreground mb-6 max-w-xs">
      上传历史文档后，AI 帮你生成产品需求文档，消除产品迭代中的逻辑断层
    </p>
    <NuxtLink to="/knowledge-base">
      <Button>
        <FileText class="w-4 h-4 mr-2" />
        去上传文档
      </Button>
    </NuxtLink>
  </div>
</template>
