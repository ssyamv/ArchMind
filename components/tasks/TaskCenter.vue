<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

interface AITask {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  title: string | null
  outputRef: string | null
  error: string | null
  createdAt: string
}

const tasks = ref<AITask[]>([])
const loading = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const runningCount = computed(() => tasks.value.filter(t => t.status === 'running' || t.status === 'pending').length)

async function fetchTasks () {
  try {
    const res = await $fetch<{ success: boolean; data: AITask[] }>('/api/v1/tasks?limit=20')
    tasks.value = res.data
  } catch {
    // 静默失败
  }
}

async function cancelTask (id: string) {
  await $fetch(`/api/v1/tasks/${id}/cancel`, { method: 'POST' })
  await fetchTasks()
}

async function retryTask (id: string) {
  await $fetch(`/api/v1/tasks/${id}/retry`, { method: 'POST' })
  await fetchTasks()
}

function taskTypeLabel (type: string): string {
  const map: Record<string, string> = {
    prd_generate: 'PRD 生成',
    prototype_generate: '原型生成',
    logic_map_generate: '逻辑图生成',
    document_process: '文档处理',
    workspace_export: '工作区导出',
  }
  return map[type] ?? type
}

function statusLabel (status: string): string {
  const map: Record<string, string> = {
    pending: '排队中',
    running: '进行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }
  return map[status] ?? status
}

function statusClass (status: string): string {
  const map: Record<string, string> = {
    pending: 'text-yellow-500',
    running: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
    cancelled: 'text-muted-foreground',
  }
  return map[status] ?? ''
}

onMounted(async () => {
  await fetchTasks()
  // 有运行中任务时每 3 秒轮询
  pollTimer = setInterval(async () => {
    if (runningCount.value > 0) {
      await fetchTasks()
    }
  }, 3000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="w-80 p-3 max-h-96 overflow-y-auto">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold">任务中心</h3>
      <span v-if="runningCount > 0" class="text-xs text-blue-500">{{ runningCount }} 个运行中</span>
    </div>

    <div v-if="tasks.length === 0" class="text-center py-6 text-sm text-muted-foreground">
      暂无任务记录
    </div>

    <div class="space-y-2">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="p-2.5 rounded-lg border bg-card text-sm"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ task.title ?? taskTypeLabel(task.type) }}</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-xs" :class="statusClass(task.status)">{{ statusLabel(task.status) }}</span>
              <span class="text-xs text-muted-foreground">· {{ taskTypeLabel(task.type) }}</span>
            </div>
          </div>
          <div class="flex gap-1 shrink-0">
            <button
              v-if="task.status === 'running' || task.status === 'pending'"
              class="text-xs text-muted-foreground hover:text-foreground"
              @click="cancelTask(task.id)"
            >
              取消
            </button>
            <button
              v-if="task.status === 'failed' || task.status === 'cancelled'"
              class="text-xs text-blue-500 hover:text-blue-600"
              @click="retryTask(task.id)"
            >
              重试
            </button>
          </div>
        </div>

        <!-- 进度条 -->
        <div v-if="task.status === 'running'" class="mt-2">
          <div class="h-1 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-500 transition-all duration-500"
              :style="{ width: `${task.progress}%` }"
            />
          </div>
          <div class="text-xs text-muted-foreground mt-0.5 text-right">{{ task.progress }}%</div>
        </div>

        <!-- 错误信息 -->
        <div v-if="task.error" class="mt-1.5 text-xs text-red-500 truncate">
          {{ task.error }}
        </div>
      </div>
    </div>
  </div>
</template>
