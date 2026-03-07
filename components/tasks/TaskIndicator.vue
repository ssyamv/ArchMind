<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Zap } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import TaskCenter from '~/components/tasks/TaskCenter.vue'

const runningCount = ref(0)
const open = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function fetchRunningCount () {
  try {
    const res = await $fetch<{ success: boolean; data: Array<{ status: string }> }>(
      '/api/v1/tasks?status=running&limit=10'
    )
    runningCount.value = res.data.length
  } catch {
    // 静默失败
  }
}

onMounted(async () => {
  await fetchRunningCount()
  pollTimer = setInterval(fetchRunningCount, 5000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="relative">
        <Zap class="h-5 w-5" />
        <Badge
          v-if="runningCount > 0"
          class="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] animate-pulse"
        >
          {{ runningCount }}
        </Badge>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" :side-offset="4" class="p-0">
      <TaskCenter />
    </PopoverContent>
  </Popover>
</template>
