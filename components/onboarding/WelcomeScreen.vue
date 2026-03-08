<script setup lang="ts">
import { CheckCircle2, Circle } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'

const props = defineProps<{
  completedSteps: number
}>()

const emit = defineEmits<{
  start: []
  skip: []
}>()

const steps = [
  { label: '配置 AI 模型', index: 0 },
  { label: '上传历史文档', index: 1 },
  { label: '生成第一份 PRD', index: 2 },
]
</script>

<template>
  <!-- 全屏覆盖层，z-50 覆盖在主内容上方 -->
  <div
    data-testid="welcome-screen"
    class="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
  >
    <div class="max-w-md w-full text-center space-y-8 p-8">
      <!-- Logo/品牌 -->
      <div class="space-y-2">
        <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <span class="text-3xl font-bold text-primary">A</span>
        </div>
        <h1 class="text-2xl font-bold text-foreground">欢迎使用 ArchMind！</h1>
        <p class="text-muted-foreground text-sm">让历史文档成为新功能的基础，3 步开始你的第一个 PRD</p>
      </div>

      <!-- 步骤列表 -->
      <div class="space-y-3 text-left">
        <div
          v-for="(s, i) in steps"
          :key="i"
          :class="[
            'flex items-center gap-3 p-3 rounded-lg border transition-colors',
            i < props.completedSteps
              ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900'
              : i === props.completedSteps
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-muted/30 opacity-60'
          ]"
        >
          <CheckCircle2
            v-if="i < props.completedSteps"
            class="w-5 h-5 text-green-500 flex-shrink-0"
          />
          <div
            v-else
            :class="[
              'w-5 h-5 rounded-full border-2 flex-shrink-0',
              i === props.completedSteps ? 'border-primary' : 'border-muted-foreground/30'
            ]"
          />
          <span :class="['text-sm font-medium', i < props.completedSteps ? 'text-green-700 dark:text-green-400' : 'text-foreground']">
            {{ s.label }}
          </span>
          <span
            v-if="i === props.completedSteps"
            class="ml-auto text-xs text-primary font-medium"
          >
            下一步
          </span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3 justify-center">
        <Button size="lg" @click="emit('start')">
          立即开始
        </Button>
        <Button variant="ghost" size="lg" @click="emit('skip')">
          跳过引导
        </Button>
      </div>
    </div>
  </div>
</template>
