<template>
  <div class="document-list">
    <!-- 批量操作栏（选中后显示） -->
    <div
      v-if="selectionMode && selectedIds.size > 0"
      class="flex items-center gap-2 mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
    >
      <span class="text-sm font-medium">已选 {{ selectedIds.size }} 项</span>
      <div class="flex gap-2 ml-auto">
        <Button size="sm" variant="destructive" :disabled="batchDeleting" @click="handleBatchDelete">
          <Loader2 v-if="batchDeleting" class="w-3.5 h-3.5 mr-1 animate-spin" />
          <Trash2 v-else class="w-3.5 h-3.5 mr-1" />
          删除
        </Button>
        <Button size="sm" variant="outline" @click="clearSelection">
          取消选择
        </Button>
      </div>
    </div>

    <!-- 列表头（含多选开关） -->
    <div class="flex items-center justify-between mb-2">
      <slot name="header" />
      <Button
        v-if="!loading && documents.length > 0"
        size="sm"
        variant="ghost"
        class="text-xs text-muted-foreground"
        @click="selectionMode = !selectionMode; clearSelection()"
      >
        {{ selectionMode ? '取消多选' : '多选' }}
      </Button>
    </div>

    <div v-if="loading" class="text-center py-8">
      <div class="flex flex-col items-center gap-2">
        <div class="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p class="text-muted-foreground">
          {{ $t('documents.loading') }}
        </p>
      </div>
    </div>

    <div v-else-if="documents.length === 0" class="text-center py-8">
      <FileText class="w-12 h-12 mx-auto text-muted-foreground mb-2" />
      <p class="text-muted-foreground">
        {{ $t('documents.noDocuments') }}
      </p>
    </div>

    <div v-else class="space-y-3">
      <Card
        v-for="doc in displayDocuments"
        :key="doc.id"
        :class="[
          'hover:shadow-md transition-shadow cursor-pointer',
          selectionMode && selectedIds.has(doc.id) ? 'ring-2 ring-primary' : '',
        ]"
        @click="selectionMode ? toggleSelect(doc.id) : $emit('select', doc.id)"
      >
        <CardContent class="p-4">
          <div class="flex items-center justify-between">
            <!-- 多选复选框 -->
            <Checkbox
              v-if="selectionMode"
              :checked="selectedIds.has(doc.id)"
              class="mr-3 flex-shrink-0"
              @click.stop="toggleSelect(doc.id)"
            />
            <div class="flex items-center space-x-3 flex-1 min-w-0">
              <component :is="getFileIcon(doc.fileType)" class="w-8 h-8 text-primary flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <h4 class="font-semibold truncate">
                  {{ doc.title }}
                </h4>
                <p class="text-sm text-muted-foreground truncate">
                  {{ getOriginalFileName(doc) }}
                </p>
                <!-- AI 推荐标签角标 -->
                <div v-if="(doc as any).autoSummary && !(doc as any).autoTagsConfirmed" class="mt-1">
                  <Badge variant="outline" class="text-xs border-amber-400 text-amber-600">AI 推荐分类</Badge>
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-2 flex-shrink-0">
              <Badge :variant="getStatusVariant(doc.processingStatus)" class="text-xs">
                {{ $t(getStatusKey(doc.processingStatus)) }}
              </Badge>
              <span class="text-sm text-muted-foreground">{{ formatFileSize(doc.fileSize) }}</span>
              <Button
                v-if="!selectionMode"
                variant="ghost"
                size="icon"
                class="text-destructive hover:text-destructive"
                @click.stop="$emit('delete', doc.id)"
              >
                <Trash2 class="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 批量删除确认 -->
    <AlertDialog :open="showDeleteConfirm" @update:open="showDeleteConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>批量删除确认</AlertDialogTitle>
          <AlertDialogDescription>
            确认删除已选的 {{ selectedIds.size }} 个文档？此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmBatchDelete"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FileText, FileType, Trash2, Loader2 } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { Document } from '@/types/document'
import { useToast } from '~/components/ui/toast/use-toast'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'

const props = defineProps<{
  documents: Document[];
  loading?: boolean;
  limit?: number;
  workspaceId?: string;
}>()

const emit = defineEmits<{
  select: [id: string];
  delete: [id: string];
  batchDeleted: [ids: string[]];
}>()

const { toast } = useToast()

const displayDocuments = computed(() => {
  if (props.limit) {
    return props.documents.slice(0, props.limit)
  }
  return props.documents
})

// ─── 多选模式 ─────────────────────────────────────────────────────────────────
const selectionMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const showDeleteConfirm = ref(false)
const batchDeleting = ref(false)

function toggleSelect (id: string) {
  const newSet = new Set(selectedIds.value)
  if (newSet.has(id)) newSet.delete(id)
  else newSet.add(id)
  selectedIds.value = newSet
}

function clearSelection () {
  selectedIds.value = new Set()
}

function handleBatchDelete () {
  showDeleteConfirm.value = true
}

async function confirmBatchDelete () {
  showDeleteConfirm.value = false
  if (!props.workspaceId || selectedIds.value.size === 0) return

  batchDeleting.value = true
  try {
    const res = await $fetch<{ success: boolean; data: { succeeded: number; failed: number } }>('/api/v1/documents/batch/delete', {
      method: 'POST',
      body: {
        ids: [...selectedIds.value],
        workspaceId: props.workspaceId,
      },
    })
    if (res.success) {
      const { succeeded, failed } = res.data
      toast({
        title: `批量删除完成`,
        description: `成功 ${succeeded} 项${failed > 0 ? `，${failed} 项失败` : ''}`,
        variant: failed > 0 ? 'destructive' : 'default',
      })
      emit('batchDeleted', [...selectedIds.value])
      clearSelection()
    }
  } catch (err: any) {
    toast({ title: '批量删除失败', description: err?.data?.message || err?.message, variant: 'destructive' })
  } finally {
    batchDeleting.value = false
  }
}

function getFileIcon (fileType: string): Component {
  const icons: Record<string, Component> = {
    pdf: FileText,
    docx: FileType,
    markdown: FileText
  }
  return icons[fileType] || FileText
}

function formatFileSize (bytes: number) {
  if (bytes < 1024) { return bytes + ' B' }
  if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + ' KB' }
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getOriginalFileName (doc: Document) {
  if (doc.metadata?.originalFileName) {
    return doc.metadata.originalFileName
  }
  return doc.filePath.split('/').pop() || doc.title
}

function getStatusVariant (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed': return 'default'
    case 'processing':
    case 'pending':
    case 'retrying': return 'secondary'
    case 'failed': return 'destructive'
    default: return 'outline'
  }
}

function getStatusKey (status?: string): string {
  switch (status) {
    case 'completed': return 'documents.status.indexed'
    case 'processing': return 'documents.status.processing'
    case 'pending': return 'documents.status.pending'
    case 'retrying': return 'documents.status.retrying'
    case 'failed': return 'documents.status.failed'
    default: return 'documents.status.pending'
  }
}
</script>
