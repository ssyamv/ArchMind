<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { AlertTriangle, Home, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  error: {
    statusCode: number
    statusMessage?: string
    message?: string
  }
}>()

const { t } = useI18n()

const isNotFound = computed(() => props.error.statusCode === 404)
const isServerError = computed(() => props.error.statusCode >= 500)

const title = computed(() => {
  if (isNotFound.value) return t('error.notFoundTitle')
  if (isServerError.value) return t('error.serverErrorTitle')
  return t('error.defaultTitle')
})

const description = computed(() => {
  if (isNotFound.value) return t('error.notFoundDescription')
  if (isServerError.value) return t('error.serverErrorDescription')
  return props.error.message || props.error.statusMessage || t('error.defaultDescription')
})

function handleGoHome() {
  clearError({ redirect: '/' })
}

function handleRefresh() {
  clearError()
  window.location.reload()
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-6">
    <div class="max-w-md w-full text-center space-y-6">
      <!-- 状态码 -->
      <div class="text-8xl font-bold text-muted-foreground/30 select-none">
        {{ error.statusCode }}
      </div>

      <!-- 图标 -->
      <div class="flex justify-center">
        <div class="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle class="w-8 h-8 text-destructive" />
        </div>
      </div>

      <!-- 标题 & 描述 -->
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold text-foreground">{{ title }}</h1>
        <p class="text-muted-foreground text-sm">{{ description }}</p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-center gap-3">
        <Button variant="default" @click="handleGoHome">
          <Home class="w-4 h-4 mr-2" />
          {{ t('error.goHome') }}
        </Button>
        <Button variant="outline" @click="handleRefresh">
          <RefreshCw class="w-4 h-4 mr-2" />
          {{ t('error.retry') }}
        </Button>
      </div>
    </div>
  </div>
</template>
