<script setup lang="ts">
import { Upload } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'

const emit = defineEmits<{ upload: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20 text-center px-6">
    <!-- SVG 插画 -->
    <div class="w-32 h-32 mb-6 text-muted-foreground/30">
      <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="16" width="64" height="84" rx="6" fill="currentColor" opacity="0.15" />
        <rect x="32" y="24" width="48" height="68" rx="4" fill="currentColor" opacity="0.2" />
        <rect x="40" y="36" width="32" height="4" rx="2" fill="currentColor" opacity="0.6" />
        <rect x="40" y="48" width="28" height="4" rx="2" fill="currentColor" opacity="0.5" />
        <rect x="40" y="60" width="24" height="4" rx="2" fill="currentColor" opacity="0.4" />
        <!-- 上传箭头 -->
        <circle cx="88" cy="88" r="24" fill="currentColor" opacity="0.1" />
        <path d="M88 100 V80 M80 88 L88 80 L96 88" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
      </svg>
    </div>

    <h3 class="text-lg font-semibold mb-2 text-foreground">上传你的第一份文档</h3>
    <p class="text-sm text-muted-foreground mb-6 max-w-xs">
      支持 PDF、DOCX、Markdown 格式，上传后 AI 将自动解析并建立知识索引
    </p>
    <Button @click="emit('upload')">
      <Upload class="w-4 h-4 mr-2" />
      上传文档
    </Button>
  </div>
</template>
