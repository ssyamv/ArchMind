<template>
  <div class="flex flex-col h-full min-h-0 overflow-hidden">
    <!-- 对比头部 -->
    <div class="flex-shrink-0 grid grid-cols-2 gap-px bg-border border-b border-border">
      <!-- 左侧 PRD 信息 -->
      <div class="bg-card px-4 py-3 flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium truncate">{{ prdA?.title || '加载中...' }}</p>
          <p class="text-xs text-muted-foreground">
            {{ prdA ? formatDate(prdA.updatedAt || prdA.createdAt) : '-' }}
          </p>
        </div>
        <Badge variant="secondary" class="shrink-0">版本 A</Badge>
      </div>
      <!-- 右侧 PRD 信息 -->
      <div class="bg-card px-4 py-3 flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium truncate">{{ prdB?.title || '加载中...' }}</p>
          <p class="text-xs text-muted-foreground">
            {{ prdB ? formatDate(prdB.updatedAt || prdB.createdAt) : '-' }}
          </p>
        </div>
        <Badge variant="outline" class="shrink-0">版本 B</Badge>
      </div>
    </div>

    <!-- 差异统计栏 -->
    <div v-if="!loading && diffSections.length > 0" class="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-muted/30 border-b border-border text-xs text-muted-foreground">
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-300" />
        新增 {{ addedCount }} 节
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" />
        删除 {{ removedCount }} 节
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-100 border border-yellow-300" />
        修改 {{ modifiedCount }} 节
      </span>
      <span class="ml-auto">共 {{ diffSections.length }} 章节</span>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <RefreshCw class="w-6 h-6 animate-spin" />
        <span class="text-sm">正在加载对比数据...</span>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground">
        <AlertCircle class="w-8 h-8 mx-auto mb-2 text-destructive" />
        <p class="text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- 对比内容区域（同步滚动） -->
    <div v-else-if="diffSections.length > 0" class="flex-1 min-h-0 grid grid-cols-2 gap-px bg-border">
      <!-- 左列 (A) -->
      <div
        ref="scrollLeftRef"
        class="bg-background overflow-y-auto"
        @scroll="syncScroll('left', $event)"
      >
        <div class="p-4 space-y-4">
          <div
            v-for="section in diffSections"
            :key="`a-${section.heading}`"
            class="rounded-lg border overflow-hidden"
            :class="getSectionClass(section, 'a')"
          >
            <div class="px-3 py-1.5 text-xs font-semibold border-b" :class="getSectionHeaderClass(section, 'a')">
              {{ section.heading || '(无标题)' }}
            </div>
            <div class="p-3 text-sm leading-relaxed">
              <!-- 已删除整节 -->
              <template v-if="section.status === 'added'">
                <span class="text-muted-foreground/50 italic text-xs">— 此版本中无此章节 —</span>
              </template>
              <!-- 有修改时展示 diff HTML -->
              <template v-else-if="section.status === 'modified' && section.diffHtml">
                <div class="prose prose-sm max-w-none diff-content" v-html="section.diffHtmlA" />
              </template>
              <!-- 相同内容 -->
              <template v-else>
                <div class="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/80">{{ section.bodyA }}</div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 右列 (B) -->
      <div
        ref="scrollRightRef"
        class="bg-background overflow-y-auto"
        @scroll="syncScroll('right', $event)"
      >
        <div class="p-4 space-y-4">
          <div
            v-for="section in diffSections"
            :key="`b-${section.heading}`"
            class="rounded-lg border overflow-hidden"
            :class="getSectionClass(section, 'b')"
          >
            <div class="px-3 py-1.5 text-xs font-semibold border-b" :class="getSectionHeaderClass(section, 'b')">
              {{ section.heading || '(无标题)' }}
            </div>
            <div class="p-3 text-sm leading-relaxed">
              <!-- 新增整节 -->
              <template v-if="section.status === 'removed'">
                <span class="text-muted-foreground/50 italic text-xs">— 此版本中无此章节 —</span>
              </template>
              <!-- 有修改时展示 diff HTML -->
              <template v-else-if="section.status === 'modified' && section.diffHtml">
                <div class="prose prose-sm max-w-none diff-content" v-html="section.diffHtmlB" />
              </template>
              <!-- 相同内容 -->
              <template v-else>
                <div class="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/80">{{ section.bodyB }}</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="flex-1 flex items-center justify-center text-muted-foreground">
      <p class="text-sm">两个版本内容完全相同</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RefreshCw, AlertCircle } from 'lucide-vue-next'
import { diff_match_patch } from 'diff-match-patch'
import { Badge } from '~/components/ui/badge'

const props = defineProps<{
  prdIdA: string
  prdIdB: string
}>()

interface PRDData {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface DiffSection {
  heading: string
  status: 'same' | 'modified' | 'added' | 'removed'
  bodyA: string
  bodyB: string
  diffHtml?: string
  diffHtmlA?: string
  diffHtmlB?: string
}

const loading = ref(true)
const error = ref('')
const prdA = ref<PRDData | null>(null)
const prdB = ref<PRDData | null>(null)
const diffSections = ref<DiffSection[]>([])

const scrollLeftRef = ref<HTMLElement | null>(null)
const scrollRightRef = ref<HTMLElement | null>(null)
let isSyncing = false

// 统计数量
const addedCount = computed(() => diffSections.value.filter(s => s.status === 'added').length)
const removedCount = computed(() => diffSections.value.filter(s => s.status === 'removed').length)
const modifiedCount = computed(() => diffSections.value.filter(s => s.status === 'modified').length)

function formatDate (dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 按 Markdown ## / ### 标题拆分段落
 */
function splitByHeadings (content: string): { heading: string; body: string }[] {
  const lines = content.split('\n')
  const sections: { heading: string; body: string }[] = []
  let currentHeading = ''
  let currentBody: string[] = []

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (currentHeading || currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() })
      }
      currentHeading = line.replace(/^#{1,3}\s+/, '').trim()
      currentBody = []
    } else {
      currentBody.push(line)
    }
  }

  if (currentHeading || currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() })
  }

  return sections
}

/**
 * 使用 diff-match-patch 对两段文本做精细 diff，返回高亮 HTML
 */
function makeDiffHtml (textA: string, textB: string): { htmlA: string; htmlB: string } {
  const dmp = new diff_match_patch()
  const diffs = dmp.diff_main(textA, textB)
  dmp.diff_cleanupSemantic(diffs)

  let htmlA = ''
  let htmlB = ''

  for (const [op, text] of diffs) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
    if (op === 0) {
      // 相同部分
      htmlA += escaped
      htmlB += escaped
    } else if (op === -1) {
      // 删除（只在 A 中显示）
      htmlA += `<mark class="diff-del">${escaped}</mark>`
    } else if (op === 1) {
      // 新增（只在 B 中显示）
      htmlB += `<mark class="diff-add">${escaped}</mark>`
    }
  }

  return { htmlA, htmlB }
}

/**
 * 比较两个 PRD 内容，生成 DiffSection[]
 */
function comparePRDs (contentA: string, contentB: string): DiffSection[] {
  const sectionsA = splitByHeadings(contentA)
  const sectionsB = splitByHeadings(contentB)

  // 建立 heading → body 的 Map
  const mapA = new Map(sectionsA.map(s => [s.heading, s.body]))
  const mapB = new Map(sectionsB.map(s => [s.heading, s.body]))

  // 合并所有 heading，保持 A 中的顺序，再追加 B 中独有的
  const allHeadings: string[] = []
  const seen = new Set<string>()
  for (const { heading } of sectionsA) {
    if (!seen.has(heading)) { allHeadings.push(heading); seen.add(heading) }
  }
  for (const { heading } of sectionsB) {
    if (!seen.has(heading)) { allHeadings.push(heading); seen.add(heading) }
  }

  return allHeadings.map((heading): DiffSection => {
    const bodyA = mapA.get(heading) ?? ''
    const bodyB = mapB.get(heading) ?? ''

    if (!mapA.has(heading)) {
      return { heading, status: 'added', bodyA: '', bodyB }
    }
    if (!mapB.has(heading)) {
      return { heading, status: 'removed', bodyA, bodyB: '' }
    }
    if (bodyA === bodyB) {
      return { heading, status: 'same', bodyA, bodyB }
    }

    const { htmlA, htmlB } = makeDiffHtml(bodyA, bodyB)
    return { heading, status: 'modified', bodyA, bodyB, diffHtmlA: htmlA, diffHtmlB: htmlB }
  })
}

function getSectionClass (section: DiffSection, side: 'a' | 'b'): string {
  if (section.status === 'same') return 'border-border'
  if (section.status === 'modified') return 'border-yellow-300 dark:border-yellow-700'
  if (section.status === 'added') {
    return side === 'b' ? 'border-green-300 dark:border-green-700' : 'border-border opacity-40'
  }
  // removed
  return side === 'a' ? 'border-red-300 dark:border-red-700' : 'border-border opacity-40'
}

function getSectionHeaderClass (section: DiffSection, side: 'a' | 'b'): string {
  if (section.status === 'same') return 'bg-muted/30 text-muted-foreground border-border'
  if (section.status === 'modified') return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800'
  if (section.status === 'added') {
    return side === 'b'
      ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800'
      : 'bg-muted/30 text-muted-foreground border-border'
  }
  return side === 'a'
    ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
    : 'bg-muted/30 text-muted-foreground border-border'
}

// 同步滚动
function syncScroll (source: 'left' | 'right', event: Event) {
  if (isSyncing) return
  isSyncing = true
  const target = event.target as HTMLElement
  const scrollTop = target.scrollTop

  if (source === 'left' && scrollRightRef.value) {
    scrollRightRef.value.scrollTop = scrollTop
  } else if (source === 'right' && scrollLeftRef.value) {
    scrollLeftRef.value.scrollTop = scrollTop
  }

  requestAnimationFrame(() => { isSyncing = false })
}

async function loadAndCompare () {
  loading.value = true
  error.value = ''
  diffSections.value = []

  try {
    const [resA, resB] = await Promise.all([
      $fetch<{ success: boolean; data: PRDData }>(`/api/v1/prd/${props.prdIdA}`),
      $fetch<{ success: boolean; data: PRDData }>(`/api/v1/prd/${props.prdIdB}`)
    ])

    if (!resA.success || !resA.data) throw new Error('加载版本 A 失败')
    if (!resB.success || !resB.data) throw new Error('加载版本 B 失败')

    prdA.value = resA.data
    prdB.value = resB.data

    diffSections.value = comparePRDs(resA.data.content || '', resB.data.content || '')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败，请重试'
  } finally {
    loading.value = false
  }
}

watch(() => [props.prdIdA, props.prdIdB], loadAndCompare, { immediate: false })
onMounted(loadAndCompare)
</script>

<style>
.diff-content mark.diff-del {
  background-color: #fee2e2;
  color: #991b1b;
  text-decoration: line-through;
  border-radius: 2px;
  padding: 0 1px;
}

.diff-content mark.diff-add {
  background-color: #dcfce7;
  color: #166534;
  border-radius: 2px;
  padding: 0 1px;
}

.dark .diff-content mark.diff-del {
  background-color: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.dark .diff-content mark.diff-add {
  background-color: rgba(34, 197, 94, 0.2);
  color: #86efac;
}
</style>
