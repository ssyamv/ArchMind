<template>
  <Transition name="mention-dropdown">
    <div
      v-if="open"
      class="absolute bottom-full left-0 mb-1 w-80 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden"
      @mousedown.prevent
    >
      <!-- 头部提示 -->
      <div class="px-3 py-2 border-b border-border">
        <p class="text-xs text-muted-foreground">
          <span class="font-semibold text-foreground">@</span>
          <span>{{ query || $t('chat.mentionSearchPlaceholder') }}</span>
        </p>
      </div>

      <!-- 文档列表 -->
      <ScrollArea class="max-h-52">
        <!-- 加载骨架 -->
        <div v-if="isLoading" class="p-2 space-y-1">
          <Skeleton v-for="i in 3" :key="i" class="h-8 w-full rounded-md" />
        </div>

        <!-- 空状态 -->
        <div v-else-if="documents.length === 0" class="px-3 py-5 text-center">
          <p class="text-xs text-muted-foreground">{{ $t('chat.mentionNoDocuments') }}</p>
        </div>

        <!-- 文档列表 -->
        <div v-else class="p-1">
          <button
            v-for="(doc, index) in documents"
            :key="doc.id"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors outline-none"
            :class="index === activeIndex
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted/60 text-foreground'"
            @click="selectDocument(doc)"
            @mouseenter="activeIndex = index"
          >
            <!-- 图标：PRD 用 ScrollText，文档用 FileText -->
            <ScrollText
              v-if="doc.sourceType === 'prd'"
              class="w-4 h-4 flex-shrink-0 text-violet-400"
            />
            <FileText
              v-else
              class="w-4 h-4 flex-shrink-0"
              :class="{
                'text-red-400': doc.fileType === 'pdf',
                'text-blue-400': doc.fileType === 'docx',
                'text-green-400': doc.fileType === 'markdown'
              }"
            />

            <!-- 文档标题 -->
            <span class="flex-1 truncate">{{ doc.title }}</span>

            <!-- 类型 Badge -->
            <Badge
              variant="outline"
              class="text-[10px] h-4 px-1 flex-shrink-0"
              :class="doc.sourceType === 'prd' ? 'border-violet-300 text-violet-600' : ''"
            >
              {{ doc.sourceType === 'prd' ? 'PRD' : (doc.fileType || 'doc').toUpperCase() }}
            </Badge>
          </button>
        </div>
      </ScrollArea>

      <!-- 底部键盘提示 -->
      <div class="px-3 py-1.5 border-t border-border bg-muted/30">
        <p class="text-[10px] text-muted-foreground">
          ↑↓ {{ $t('chat.mentionNavigate') }} · Enter {{ $t('chat.mentionSelect') }} · Esc {{ $t('chat.mentionClose') }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { FileText, ScrollText } from 'lucide-vue-next'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
import type { MentionedDocument } from '~/types/conversation'

interface DocumentListResponse {
  success: boolean
  data: {
    documents: Array<{
      id: string
      title: string
      fileType: string
      status?: string
      processingStatus?: string
    }>
    total: number
    page: number
    limit: number
  }
}

interface PrdListResponse {
  success: boolean
  data: {
    prds: Array<{
      id: string
      title: string
      metadata?: { ragEnabled?: boolean; ragStatus?: string }
    }>
    total: number
    page: number
    limit: number
  }
}

const props = defineProps<{
  open: boolean
  query: string
  workspaceId?: string
}>()

const emit = defineEmits<{
  select: [doc: MentionedDocument]
  close: []
}>()

const documents = ref<MentionedDocument[]>([])
const isLoading = ref(false)
const activeIndex = ref(0)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let allDocuments: MentionedDocument[] = []
let hasFetched = false
let fetchedWorkspaceId: string | undefined = undefined

// 初次打开时拉取全量文档列表，后续前端过滤
watch(() => props.open, async (isOpen) => {
  const currentWsId = props.workspaceId ? String(props.workspaceId) : undefined
  if (isOpen && (!hasFetched || fetchedWorkspaceId !== currentWsId)) {
    await fetchAllDocuments()
  }
  if (isOpen) {
    activeIndex.value = 0
    filterDocuments(props.query)
  }
})

// 监听搜索词变化，前端过滤
watch(() => props.query, (newQuery) => {
  if (!props.open) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filterDocuments(newQuery)
  }, 150)
})

async function fetchAllDocuments() {
  isLoading.value = true
  hasFetched = true
  const workspaceId = props.workspaceId ? String(props.workspaceId) : undefined
  fetchedWorkspaceId = workspaceId
  try {
    const queryParams = new URLSearchParams({ limit: '200', page: '1' })
    if (workspaceId) queryParams.set('workspace_id', workspaceId)
    const qs = queryParams.toString()

    const [docsRes, prdsRes] = await Promise.all([
      $fetch<DocumentListResponse>(`/api/v1/documents?${qs}`).catch(() => null),
      $fetch<PrdListResponse>(`/api/v1/prd?${qs}`).catch(() => null)
    ])

    const docItems: MentionedDocument[] = docsRes?.success
      ? docsRes.data.documents
          .filter(d => d.status !== 'error' && d.processingStatus !== 'failed')
          .map(d => ({
            id: d.id,
            title: d.title,
            fileType: (['pdf', 'docx', 'markdown'].includes(d.fileType)
              ? d.fileType
              : 'markdown') as 'pdf' | 'docx' | 'markdown',
            sourceType: 'document' as const
          }))
      : []

    const prdItems: MentionedDocument[] = prdsRes?.success
      ? prdsRes.data.prds
          .filter(p => p.metadata?.ragEnabled === true && p.metadata?.ragStatus === 'completed')
          .map(p => ({
            id: p.id,
            title: p.title,
            fileType: 'prd' as const,
            sourceType: 'prd' as const
          }))
      : []

    allDocuments = [...docItems, ...prdItems]
    filterDocuments(props.query)

    if (!docsRes?.success && !prdsRes?.success) {
      hasFetched = false
    }
  } catch (err) {
    console.error('[DocumentMentionDropdown] 拉取列表失败:', err)
    hasFetched = false
    fetchedWorkspaceId = undefined
    allDocuments = []
  } finally {
    isLoading.value = false
  }
}

function filterDocuments(query: string) {
  const filtered = query
    ? allDocuments.filter(d => d.title.toLowerCase().includes(query.toLowerCase()))
    : allDocuments

  documents.value = filtered.slice(0, 8)
  activeIndex.value = 0
}

function selectDocument(doc: MentionedDocument) {
  emit('select', doc)
}

defineExpose({
  navigateUp() {
    activeIndex.value = Math.max(0, activeIndex.value - 1)
  },
  navigateDown() {
    activeIndex.value = Math.min(documents.value.length - 1, activeIndex.value + 1)
  },
  confirmSelection() {
    const doc = documents.value[activeIndex.value]
    if (doc) selectDocument(doc)
  }
})
</script>

<style scoped>
.mention-dropdown-enter-active,
.mention-dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.mention-dropdown-enter-from,
.mention-dropdown-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
