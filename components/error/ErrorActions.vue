<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { Home, RefreshCw, ArrowLeft } from 'lucide-vue-next'

const props = defineProps<{
  code: 404 | 403 | 500
  href?: string | null
  actionLabel?: string
}>()

function handleAction() {
  if (props.href) {
    clearError({ redirect: props.href })
  } else {
    clearError()
    window.location.reload()
  }
}

function handleBack() {
  clearError()
  window.history.back()
}
</script>

<template>
  <div class="flex flex-wrap justify-center gap-3">
    <Button variant="default" @click="handleAction">
      <Home v-if="href" class="w-4 h-4 mr-2" />
      <RefreshCw v-else class="w-4 h-4 mr-2" />
      {{ actionLabel || (href ? '返回首页' : '刷新重试') }}
    </Button>
    <Button variant="outline" @click="handleBack">
      <ArrowLeft class="w-4 h-4 mr-2" />
      返回上页
    </Button>
  </div>
</template>
