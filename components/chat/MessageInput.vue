<template>
  <div class="p-4 flex-shrink-0">
    <!-- Integrated Input Container -->
    <div
      ref="containerRef"
      class="relative rounded-xl bg-muted shadow-sm transition-all"
      :style="{ height: `${containerHeight}px` }"
    >
      <!-- @ 文档提及下拉菜单 -->
      <DocumentMentionDropdown
        ref="dropdownRef"
        :open="mentionActive"
        :query="mentionQuery"
        :workspace-id="currentWorkspaceId"
        class="absolute bottom-full left-4"
        @select="onSelectDocument"
        @close="closeMentionDropdown"
      />

      <!-- Resize Handle -->
      <div
        class="resize-handle absolute top-0 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center group select-none"
        :class="{ 'is-resizing': isResizing }"
        @mousedown="startResize"
      >
        <div class="w-12 h-1 rounded-full bg-border transition-all group-hover:bg-primary group-hover:w-16" />
      </div>

      <!-- Input Area -->
      <Textarea
        ref="textareaRef"
        v-model="input"
        :placeholder="$t('chat.inputPlaceholder')"
        :disabled="isLoading"
        class="w-full h-full resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 pt-3 bg-transparent"
        :class="mentionedDocs.length > 0 ? 'pb-20' : 'pb-12'"
        @keydown="handleKeydown"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
        style="padding-left: 1rem; padding-right: 1rem;"
      />

      <!-- 已选文档 Badge 行（输入框内，底部控制栏上方） -->
      <div
        v-if="mentionedDocs.length > 0"
        class="absolute left-0 right-0 px-3 flex items-center gap-1 flex-wrap"
        style="bottom: 44px;"
      >
        <div
          v-for="doc in mentionedDocs"
          :key="doc.id"
          class="inline-flex items-center gap-1 h-6 rounded-md px-1.5 text-xs border cursor-default select-none"
          :class="doc.sourceType === 'prd'
            ? 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-300'
            : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300'"
          :title="doc.title"
        >
          <ScrollText v-if="doc.sourceType === 'prd'" class="w-3 h-3 flex-shrink-0" />
          <FileText v-else class="w-3 h-3 flex-shrink-0" />
          <span class="max-w-[120px] truncate font-medium">{{ doc.title }}</span>
          <button
            class="ml-0.5 rounded-full p-0.5 opacity-60 hover:opacity-100 transition-opacity"
            :class="doc.sourceType === 'prd' ? 'hover:bg-violet-200 dark:hover:bg-violet-800' : 'hover:bg-blue-200 dark:hover:bg-blue-800'"
            @click="removeMentionedDoc(doc.id)"
          >
            <X class="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      <!-- Bottom Controls Bar -->
      <div ref="bottomBarRef" class="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between bg-transparent rounded-b-lg">
        <!-- Left Controls -->
        <div ref="leftControlsRef" class="flex items-center gap-2 shrink-0 flex-wrap">
          <!-- Target Selector -->
          <TargetSelector
            v-model="selectedTarget"
            :is-loading="isLoading"
          />

          <!-- Model Selector -->
          <Select v-model="selectedModel" :disabled="isLoading">
            <SelectTrigger class="h-8 w-[160px] text-xs border-0 shadow-none hover:bg-background/80 bg-transparent">
              <SelectValue :placeholder="$t('chat.selectModel')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="model in availableModels" :key="model.id" :value="model.id">
                {{ model.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- RAG Toggle -->
          <Button
            variant="ghost"
            size="sm"
            :disabled="isLoading"
            class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background/60"
            @click="useRAG = !useRAG"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="useRAG ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/30'"
            />
            <BookOpen class="w-3.5 h-3.5" />
            <span>RAG</span>
          </Button>
        </div>

        <!-- Right Controls -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Keyboard Hint (hidden entirely when space is insufficient) -->
          <span
            ref="hintRef"
            class="text-xs text-muted-foreground whitespace-nowrap"
            :class="{ 'invisible absolute': !showHint }"
          >
            {{ $t('chat.sendShortcutEnter') }}
          </span>

          <!-- Send Button -->
          <Button
            size="sm"
            :disabled="!input.trim() || isLoading"
            @click="handleSubmit"
            class="h-8 w-8 p-0 shrink-0"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { BookOpen, Send, Loader2, X, FileText, ScrollText } from 'lucide-vue-next'
import TargetSelector from './TargetSelector.vue'
import DocumentMentionDropdown from './DocumentMentionDropdown.vue'
import type { ConversationTargetType, MentionedDocument } from '~/types/conversation'

const { locale } = useI18n()

const emit = defineEmits<{
  send: [message: string, options: { modelId: string; useRAG: boolean; target: ConversationTargetType; documentIds: string[]; prdIds: string[] }]
}>()

const props = defineProps<{
  isLoading?: boolean
  availableModels: Array<{ id: string; label: string }>
  workspaceId?: string
}>()

const RAG_STORAGE_KEY = 'archmind-use-rag'
const HEIGHT_STORAGE_KEY = 'archmind-input-height'
const TARGET_STORAGE_KEY = 'archmind-conversation-target'
const MIN_HEIGHT = 120
const MAX_HEIGHT = 400
const DEFAULT_HEIGHT = 160

const input = ref('')
const selectedModel = ref(props.availableModels[0]?.id || '')
const selectedTarget = ref<ConversationTargetType>('prd')
const useRAG = ref(false)
const isComposing = ref(false)
const containerRef = ref<HTMLDivElement>()
const textareaRef = ref()
const bottomBarRef = ref<HTMLDivElement>()
const leftControlsRef = ref<HTMLDivElement>()
const hintRef = ref<HTMLSpanElement>()
const containerHeight = ref(DEFAULT_HEIGHT)
const isResizing = ref(false)
const startY = ref(0)
const startHeight = ref(0)
const showHint = ref(false)
let resizeObserver: ResizeObserver | null = null
let hintNaturalWidth = 0

// @ 提及相关状态
const mentionActive = ref(false)
const mentionQuery = ref('')
const mentionedDocs = ref<MentionedDocument[]>([])
const mentionStartIndex = ref(-1)
const dropdownRef = ref<InstanceType<typeof DocumentMentionDropdown>>()

// 工作区 ID：优先使用 prop，其次从 localStorage 获取
const currentWorkspaceId = computed(() => {
  if (props.workspaceId) return props.workspaceId
  if (process.client) {
    return localStorage.getItem('current-workspace-id') || undefined
  }
  return undefined
})

// 检测底部栏是否有足够空间显示 tips
function checkHintVisibility() {
  if (!bottomBarRef.value || !leftControlsRef.value) return
  const barWidth = bottomBarRef.value.clientWidth
  const leftWidth = leftControlsRef.value.offsetWidth
  // 发送按钮 32px + gap 8px + justify-between 间距
  const rightFixedWidth = 40
  const available = barWidth - leftWidth - rightFixedWidth
  // hintNaturalWidth 包含 tips 文字宽度 + gap
  showHint.value = available >= hintNaturalWidth + 8
}

// 从 localStorage 恢复状态
onMounted(() => {
  const savedRAGState = localStorage.getItem(RAG_STORAGE_KEY)
  if (savedRAGState !== null) {
    useRAG.value = savedRAGState === 'true'
  }

  const savedHeight = localStorage.getItem(HEIGHT_STORAGE_KEY)
  if (savedHeight) {
    const height = parseInt(savedHeight, 10)
    if (height >= MIN_HEIGHT && height <= MAX_HEIGHT) {
      containerHeight.value = height
    }
  }

  const savedTarget = localStorage.getItem(TARGET_STORAGE_KEY) as ConversationTargetType | null
  if (savedTarget && (savedTarget === 'prd' || savedTarget === 'prototype')) {
    selectedTarget.value = savedTarget
  }

  // 先测量 hint 的自然宽度（此时 hint 为 invisible absolute，不影响布局但可测量）
  if (hintRef.value) {
    hintNaturalWidth = hintRef.value.offsetWidth
  }

  // 监听底部控制栏宽度，决定是否显示 tips
  if (bottomBarRef.value) {
    resizeObserver = new ResizeObserver(() => {
      checkHintVisibility()
    })
    resizeObserver.observe(bottomBarRef.value)
    checkHintVisibility()
  }
})

// 监听语言切换，重新测量 hint 宽度并检查可见性
watch(locale, async () => {
  showHint.value = false
  await nextTick()
  if (hintRef.value) {
    hintNaturalWidth = hintRef.value.offsetWidth
  }
  checkHintVisibility()
})

// 监听 RAG 开关变化,持久化到 localStorage
watch(useRAG, (newValue) => {
  try { localStorage.setItem(RAG_STORAGE_KEY, String(newValue)) } catch { /* quota exceeded */ }
})

// 监听目标切换,持久化到 localStorage
watch(selectedTarget, (newValue) => {
  try { localStorage.setItem(TARGET_STORAGE_KEY, newValue) } catch { /* quota exceeded */ }
})

// 监听高度变化,持久化到 localStorage
watch(containerHeight, (newValue) => {
  try { localStorage.setItem(HEIGHT_STORAGE_KEY, String(newValue)) } catch { /* quota exceeded */ }
})

// Auto-select first model when availableModels changes
watch(
  () => props.availableModels,
  (newModels) => {
    if (newModels.length > 0 && !selectedModel.value) {
      selectedModel.value = newModels[0].id
    }
  }
)

// 监听 input 变化，检测 @ 触发
watch(input, async () => {
  await nextTick()
  detectMentionTrigger()
})

/**
 * 检测光标前是否有 @ 触发
 */
function detectMentionTrigger() {
  // 通过 $el 访问原生 textarea 元素
  const textarea = textareaRef.value?.$el as HTMLTextAreaElement | undefined
  if (!textarea) return

  const cursorPos = textarea.selectionStart ?? input.value.length
  const textBeforeCursor = input.value.substring(0, cursorPos)

  // 从光标位置向前查找最近的 @
  const atIndex = textBeforeCursor.lastIndexOf('@')

  if (atIndex === -1) {
    if (mentionActive.value) closeMentionDropdown()
    return
  }

  // @ 前面必须是行首或空白字符（避免 email 地址误触发）
  const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' '
  if (charBeforeAt !== ' ' && charBeforeAt !== '\n' && atIndex !== 0) {
    if (mentionActive.value) closeMentionDropdown()
    return
  }

  // 提取 @ 后面的搜索词（只取不含空格的部分）
  const queryText = textBeforeCursor.substring(atIndex + 1)
  if (queryText.includes(' ') || queryText.includes('\n')) {
    // @ 后面已有空格，说明引用已完成，关闭菜单
    if (mentionActive.value) closeMentionDropdown()
    return
  }

  mentionStartIndex.value = atIndex
  mentionQuery.value = queryText
  mentionActive.value = true
}


/**
 * 用户选择文档后的处理
 */
function onSelectDocument(doc: MentionedDocument) {
  // 检查是否已经选择过
  if (!mentionedDocs.value.find(d => d.id === doc.id)) {
    mentionedDocs.value.push(doc)
  }

  // 从 input 中移除 @query 文本（只保留 @ 前后的内容）
  const before = input.value.substring(0, mentionStartIndex.value)
  const afterQuery = input.value.substring(mentionStartIndex.value + 1 + mentionQuery.value.length)
  // 去掉末尾多余的空格
  input.value = before + afterQuery.replace(/^\s*/, '')

  closeMentionDropdown()

  // 聚焦并将光标移到删除位置
  nextTick(() => {
    const textarea = textareaRef.value?.$el as HTMLTextAreaElement | undefined
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(before.length, before.length)
    }
  })
}

/**
 * 移除已选文档 Badge
 */
function removeMentionedDoc(docId: string) {
  mentionedDocs.value = mentionedDocs.value.filter(d => d.id !== docId)
}

/**
 * 关闭 @ 提及下拉菜单
 */
function closeMentionDropdown() {
  mentionActive.value = false
  mentionQuery.value = ''
  mentionStartIndex.value = -1
}

function startResize(event: MouseEvent) {
  isResizing.value = true
  startY.value = event.clientY
  startHeight.value = containerHeight.value

  // 添加 body 样式防止选中文本
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ns-resize'

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  event.preventDefault()
}

function handleResize(event: MouseEvent) {
  if (!isResizing.value) return

  // 使用 requestAnimationFrame 优化性能
  requestAnimationFrame(() => {
    const deltaY = startY.value - event.clientY // 向上为正
    const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight.value + deltaY))
    containerHeight.value = newHeight
  })
}

function stopResize() {
  isResizing.value = false

  // 恢复 body 样式
  document.body.style.userSelect = ''
  document.body.style.cursor = ''

  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  resizeObserver?.disconnect()
  resizeObserver = null
})

function handleKeydown (event: KeyboardEvent) {
  // 当 @ 下拉菜单打开时，拦截导航和选择键
  if (mentionActive.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      dropdownRef.value?.navigateDown()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      dropdownRef.value?.navigateUp()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && !isComposing.value) {
      event.preventDefault()
      dropdownRef.value?.confirmSelection()
      return
    }
    if (event.key === 'Escape') {
      closeMentionDropdown()
      return
    }
  }

  // Enter without Shift sends the message (but not during IME composition)
  if (event.key === 'Enter' && !event.shiftKey && !isComposing.value) {
    event.preventDefault()
    handleSubmit()
  }
  // Shift+Enter allows newline (default textarea behavior)
}

function handleSubmit () {
  if (!input.value.trim() || props.isLoading) return
  const documentIds = mentionedDocs.value.filter(d => d.sourceType === 'document').map(d => d.id)
  const prdIds = mentionedDocs.value.filter(d => d.sourceType === 'prd').map(d => d.id)
  emit('send', input.value, {
    modelId: selectedModel.value,
    useRAG: useRAG.value,
    target: selectedTarget.value,
    documentIds,
    prdIds
  })
  input.value = ''
  mentionedDocs.value = []
}
</script>

<style scoped>
.resize-handle {
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.resize-handle.is-resizing {
  cursor: ns-resize !important;
}

/* 拖拽时禁用文本选择 */
.resize-handle.is-resizing * {
  user-select: none !important;
  -webkit-user-select: none !important;
}

</style>
