<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { FileText, FileCode, GitBranch, Search, Loader2 } from 'lucide-vue-next'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'

const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const route = useRoute()
const query = ref('')
const loading = ref(false)

// 从路由参数中获取工作区 ID（支持 /workspace/[id]/* 路径）
const currentWorkspaceId = computed(() => {
  return (route.params.id as string) || (route.params.workspaceId as string) || null
})

interface SearchResultItem {
  id: string
  type: 'document' | 'prd' | 'logic_map'
  title: string
  snippet: string | null
  relevance: number
  createdAt: string
}

interface SearchResults {
  document: SearchResultItem[]
  prd: SearchResultItem[]
  logic_map: SearchResultItem[]
  total: number
}

const results = ref<SearchResults>({ document: [], prd: [], logic_map: [], total: 0 })

// 键盘导航
const activeIndex = ref(-1)
const flatResults = computed(() => {
  return [
    ...results.value.document,
    ...results.value.prd,
    ...results.value.logic_map,
  ]
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(query, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  activeIndex.value = -1
  if (!val.trim()) {
    results.value = { document: [], prd: [], logic_map: [], total: 0 }
    return
  }
  debounceTimer = setTimeout(() => doSearch(val.trim()), 300)
})

// 当 dialog 打开时重置状态
watch(open, (val) => {
  if (!val) {
    query.value = ''
    activeIndex.value = -1
    results.value = { document: [], prd: [], logic_map: [], total: 0 }
  }
})

async function doSearch (q: string) {
  const workspaceId = currentWorkspaceId.value
  if (!workspaceId) return
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; data: SearchResults }>(
      `/api/v1/search?q=${encodeURIComponent(q)}&workspaceId=${workspaceId}`
    )
    results.value = res.data
  } catch {
    // 静默失败
  } finally {
    loading.value = false
  }
}

function handleKeydown (e: KeyboardEvent) {
  const total = flatResults.value.length
  if (total === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % total
    scrollToActive()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = activeIndex.value <= 0 ? total - 1 : activeIndex.value - 1
    scrollToActive()
  } else if (e.key === 'Enter' && activeIndex.value >= 0) {
    e.preventDefault()
    const item = flatResults.value[activeIndex.value]
    if (item) navigateTo(item)
  }
}

function scrollToActive () {
  nextTick(() => {
    const el = document.querySelector(`[data-search-index="${activeIndex.value}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function isActive (item: SearchResultItem): boolean {
  const idx = flatResults.value.indexOf(item)
  return idx === activeIndex.value
}

function navigateTo (item: SearchResultItem) {
  open.value = false
  query.value = ''
  switch (item.type) {
    case 'document':
      router.push(`/documents/${item.id}`)
      break
    case 'prd':
      router.push(`/prd/${item.id}`)
      break
    case 'logic_map':
      router.push(`/logic-maps/${item.id}`)
      break
  }
}

function typeIcon (type: string) {
  switch (type) {
    case 'document': return FileText
    case 'prd': return FileCode
    case 'logic_map': return GitBranch
    default: return FileText
  }
}

function typeLabel (type: string): string {
  const map: Record<string, string> = { document: '文档', prd: 'PRD', logic_map: '逻辑图' }
  return map[type] ?? type
}

function getItemIndex (item: SearchResultItem): number {
  return flatResults.value.indexOf(item)
}

const hasResults = computed(() => results.value.total > 0)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="p-0 gap-0 max-w-lg overflow-hidden" @keydown="handleKeydown">
      <!-- 搜索输入框 -->
      <div class="flex items-center gap-2 px-4 py-3 border-b">
        <Search v-if="!loading" class="w-4 h-4 text-muted-foreground shrink-0" />
        <Loader2 v-else class="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
        <Input
          v-model="query"
          placeholder="搜索文档、PRD、逻辑图..."
          class="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-base"
          autofocus
        />
        <kbd class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Esc</kbd>
      </div>

      <!-- 搜索结果 -->
      <div class="max-h-96 overflow-y-auto">
        <!-- 空态 -->
        <div v-if="!query" class="p-6 text-center text-sm text-muted-foreground">
          输入关键词搜索文档、PRD 和逻辑图
        </div>

        <div v-else-if="!loading && !hasResults" class="p-6 text-center text-sm text-muted-foreground">
          没有找到与「{{ query }}」相关的内容
        </div>

        <!-- 结果分组 -->
        <div v-else class="py-1">
          <!-- 文档 -->
          <template v-if="results.document.length > 0">
            <div class="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              文档（{{ results.document.length }}）
            </div>
            <button
              v-for="item in results.document"
              :key="item.id"
              :data-search-index="getItemIndex(item)"
              :class="[
                'w-full flex items-start gap-3 px-3 py-2.5 transition-colors text-left',
                isActive(item) ? 'bg-accent' : 'hover:bg-accent',
              ]"
              @click="navigateTo(item)"
              @mouseenter="activeIndex = getItemIndex(item)"
            >
              <FileText class="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ item.title }}</div>
                <div v-if="item.snippet" class="text-xs text-muted-foreground truncate mt-0.5">{{ item.snippet }}</div>
              </div>
              <span class="text-xs text-muted-foreground shrink-0">{{ Math.round(item.relevance * 100) }}%</span>
            </button>
          </template>

          <!-- PRD -->
          <template v-if="results.prd.length > 0">
            <div class="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t">
              PRD（{{ results.prd.length }}）
            </div>
            <button
              v-for="item in results.prd"
              :key="item.id"
              :data-search-index="getItemIndex(item)"
              :class="[
                'w-full flex items-start gap-3 px-3 py-2.5 transition-colors text-left',
                isActive(item) ? 'bg-accent' : 'hover:bg-accent',
              ]"
              @click="navigateTo(item)"
              @mouseenter="activeIndex = getItemIndex(item)"
            >
              <FileCode class="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ item.title }}</div>
                <div v-if="item.snippet" class="text-xs text-muted-foreground truncate mt-0.5">{{ item.snippet }}</div>
              </div>
            </button>
          </template>

          <!-- 逻辑图 -->
          <template v-if="results.logic_map.length > 0">
            <div class="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t">
              逻辑图（{{ results.logic_map.length }}）
            </div>
            <button
              v-for="item in results.logic_map"
              :key="item.id"
              :data-search-index="getItemIndex(item)"
              :class="[
                'w-full flex items-start gap-3 px-3 py-2.5 transition-colors text-left',
                isActive(item) ? 'bg-accent' : 'hover:bg-accent',
              ]"
              @click="navigateTo(item)"
              @mouseenter="activeIndex = getItemIndex(item)"
            >
              <GitBranch class="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div class="text-sm font-medium truncate">{{ item.title }}</div>
            </button>
          </template>
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="border-t px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span><kbd class="bg-muted px-1 rounded">↑↓</kbd> 导航</span>
        <span><kbd class="bg-muted px-1 rounded">↵</kbd> 打开</span>
        <span><kbd class="bg-muted px-1 rounded">Esc</kbd> 关闭</span>
      </div>
    </DialogContent>
  </Dialog>
</template>
