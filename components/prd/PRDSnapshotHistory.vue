<template>
  <div class="flex flex-col h-full">
    <!-- 工具栏 -->
    <div class="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border">
      <span class="text-sm font-medium text-foreground">版本历史</span>
      <Button
        variant="ghost"
        size="icon"
        class="w-7 h-7"
        :disabled="loading"
        @click="loadSnapshots"
      >
        <RefreshCw :class="['w-3.5 h-3.5', loading && 'animate-spin']" />
      </Button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex-1 flex items-center justify-center text-muted-foreground">
      <RefreshCw class="w-4 h-4 animate-spin mr-2" />
      <span class="text-sm">加载中...</span>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="snapshots.length === 0"
      class="flex-1 flex items-center justify-center text-muted-foreground px-4"
    >
      <div class="text-center">
        <History class="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p class="text-sm mb-1">尚无版本记录</p>
        <p class="text-xs opacity-60">使用顶部「保存版本」按钮创建命名版本</p>
      </div>
    </div>

    <!-- 快照列表 -->
    <ScrollArea v-else class="flex-1">
      <div class="p-3 space-y-2">
        <div
          v-for="snapshot in snapshots"
          :key="snapshot.id"
          class="rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors"
        >
          <!-- 顶部：Badge + 时间 -->
          <div class="flex items-center gap-2 mb-1.5">
            <Badge v-if="snapshot.snapshotType === 'manual'" class="text-xs px-1.5 py-0">
              <Tag class="w-2.5 h-2.5 mr-1" />
              手动
            </Badge>
            <Badge v-else variant="secondary" class="text-xs px-1.5 py-0">
              <Zap class="w-2.5 h-2.5 mr-1" />
              自动
            </Badge>
            <span class="text-xs text-muted-foreground">{{ formatTime(snapshot.createdAt) }}</span>
          </div>

          <!-- 版本名称 / 默认提示 -->
          <p class="text-sm font-medium leading-tight mb-1">
            {{ snapshot.tag || (snapshot.snapshotType === 'manual' ? '未命名版本' : '自动快照') }}
          </p>

          <!-- 备注 -->
          <p v-if="snapshot.description" class="text-xs text-muted-foreground mb-1.5 line-clamp-2">
            {{ snapshot.description }}
          </p>

          <!-- 字符数 -->
          <p class="text-xs text-muted-foreground mb-2.5">
            {{ snapshot.contentSize.toLocaleString() }} 字符
          </p>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-xs px-2 gap-1"
              :disabled="!!restoringId || !!deletingId"
              @click="openRestoreDialog(snapshot)"
            >
              <RotateCcw class="w-3 h-3" />
              恢复
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-xs px-2 gap-1"
              :disabled="!!deletingId"
              @click="goCompare(snapshot)"
            >
              <GitCompare class="w-3 h-3" />
              对比
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-xs px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              :disabled="!!restoringId || !!deletingId"
              @click="openDeleteDialog(snapshot)"
            >
              <Trash2 class="w-3 h-3" />
              删除
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>

    <!-- 恢复确认 AlertDialog -->
    <AlertDialog v-model:open="restoreDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认恢复此版本？</AlertDialogTitle>
          <AlertDialogDescription>
            当前 PRD 内容将被替换为此版本的内容（"{{ pendingSnapshot?.tag || '此快照' }}"）。
            系统会在恢复前自动备份当前内容，您仍可从历史记录中找回。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="!!restoringId">取消</AlertDialogCancel>
          <AlertDialogAction
            :disabled="!!restoringId"
            @click="confirmRestore"
          >
            <Loader2 v-if="restoringId" class="w-4 h-4 animate-spin mr-2" />
            确认恢复
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 删除确认 AlertDialog -->
    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除此版本？</AlertDialogTitle>
          <AlertDialogDescription>
            将永久删除版本"{{ pendingDeleteSnapshot?.tag || '此快照' }}"，此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="!!deletingId">取消</AlertDialogCancel>
          <AlertDialogAction
            :disabled="!!deletingId"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDelete"
          >
            <Loader2 v-if="deletingId" class="w-4 h-4 animate-spin mr-2" />
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import {
  RefreshCw, History, Tag, Zap, RotateCcw, GitCompare, Loader2, Trash2
} from 'lucide-vue-next'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '~/components/ui/alert-dialog'
import { useToast } from '~/components/ui/toast/use-toast'

interface PRDSnapshotItem {
  id: string
  prdId: string
  snapshotType: 'auto' | 'manual'
  tag: string | null
  description: string | null
  contentSize: number
  createdAt: string
}

const props = defineProps<{
  prdId: string | undefined
}>()

const emit = defineEmits<{
  restore: [content: string]
}>()

const router = useRouter()
const { toast } = useToast()

const snapshots = ref<PRDSnapshotItem[]>([])
const loading = ref(false)
const restoringId = ref<string | null>(null)
const restoreDialogOpen = ref(false)
const pendingSnapshot = ref<PRDSnapshotItem | null>(null)
const deletingId = ref<string | null>(null)
const deleteDialogOpen = ref(false)
const pendingDeleteSnapshot = ref<PRDSnapshotItem | null>(null)

function formatTime (dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function loadSnapshots () {
  if (!props.prdId) return
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: PRDSnapshotItem[] }>(
      `/api/v1/prd/${props.prdId}/snapshots`
    )
    if (res.success) {
      snapshots.value = res.data || []
    }
  } catch {
    // 静默失败
  } finally {
    loading.value = false
  }
}

function openRestoreDialog (snapshot: PRDSnapshotItem) {
  pendingSnapshot.value = snapshot
  restoreDialogOpen.value = true
}

async function confirmRestore () {
  if (!pendingSnapshot.value || !props.prdId) return
  restoringId.value = pendingSnapshot.value.id

  try {
    const res = await $fetch<{ success: boolean; data: { content: string } }>(
      `/api/v1/prd/${props.prdId}/snapshots/${pendingSnapshot.value.id}/restore`,
      { method: 'POST' }
    )
    if (res.success) {
      emit('restore', res.data.content)
      toast({ title: '已恢复到此版本', description: pendingSnapshot.value.tag || '自动快照' })
      restoreDialogOpen.value = false
      // 刷新列表（恢复前会创建一条 auto 快照）
      await loadSnapshots()
    }
  } catch {
    toast({ title: '恢复失败，请重试', variant: 'destructive' })
  } finally {
    restoringId.value = null
    pendingSnapshot.value = null
  }
}

function goCompare (snapshot: PRDSnapshotItem) {
  if (!props.prdId) return
  router.push(`/prd-compare?mode=snapshot&root=${props.prdId}&a=${snapshot.id}`)
}

function openDeleteDialog (snapshot: PRDSnapshotItem) {
  pendingDeleteSnapshot.value = snapshot
  deleteDialogOpen.value = true
}

async function confirmDelete () {
  if (!pendingDeleteSnapshot.value || !props.prdId) return
  deletingId.value = pendingDeleteSnapshot.value.id

  try {
    await $fetch(
      `/api/v1/prd/${props.prdId}/snapshots/${pendingDeleteSnapshot.value.id}`,
      { method: 'DELETE' }
    )
    toast({
      title: '版本已删除',
      description: pendingDeleteSnapshot.value.tag || '快照已删除'
    })
    deleteDialogOpen.value = false
    // 刷新列表
    await loadSnapshots()
  } catch {
    toast({ title: '删除失败，请重试', variant: 'destructive' })
  } finally {
    deletingId.value = null
    pendingDeleteSnapshot.value = null
  }
}

onMounted(loadSnapshots)

watch(() => props.prdId, (newId) => {
  if (newId) loadSnapshots()
})
</script>
