<template>
  <div :class="isFullscreen ? 'fixed inset-0 z-50 bg-background flex flex-col' : 'flex flex-col h-full overflow-hidden'">
    <!-- Header -->
    <div class="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
      <h3 class="text-sm font-bold text-foreground tracking-tight">
        {{ $t('generate.documentEditor') }}
      </h3>
      <div v-if="content" class="flex items-center gap-1">
        <!-- Editor Mode Toggle -->
        <div class="flex items-center border border-border rounded-md p-0.5 mr-1">
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-xs"
            :class="{ 'bg-accent text-accent-foreground': editorMode === 'rich' }"
            @click="editorMode = 'rich'"
          >
            {{ $t('generate.richTextMode') }}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-xs"
            :class="{ 'bg-accent text-accent-foreground': editorMode === 'markdown' }"
            @click="switchToMarkdown"
          >
            {{ $t('generate.markdownMode') }}
          </Button>
        </div>
        <!-- Preview Toggle (only in markdown mode) -->
        <Button
          v-if="editorMode === 'markdown'"
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-xs mr-1"
          :class="{ 'bg-accent text-accent-foreground': showPreview }"
          @click="showPreview = !showPreview"
        >
          <Eye class="w-3.5 h-3.5 mr-1" />
          {{ $t('generate.preview') }}
        </Button>
        <!-- Fullscreen Toggle -->
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :title="isFullscreen ? $t('generate.exitFullscreen') : $t('generate.fullscreen')"
          @click="toggleFullscreen"
        >
          <Minimize2 v-if="isFullscreen" class="w-4 h-4" />
          <Maximize2 v-else class="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :title="$t('generate.exportDeliverable')"
          @click="downloadPrd"
        >
          <Download class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- Toolbar (only show in rich text mode) -->
    <div v-if="editor && editorMode === 'rich'" class="flex-shrink-0 border-b border-border px-2 py-1.5 flex flex-wrap items-center gap-0.5 bg-muted/20">
      <!-- Text formatting -->
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
        title="Bold (Ctrl+B)"
      >
        <Bold class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
        title="Italic (Ctrl+I)"
      >
        <Italic class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('strike') }"
        @click="editor.chain().focus().toggleStrike().run()"
        title="Strikethrough"
      >
        <Strikethrough class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('code') }"
        @click="editor.chain().focus().toggleCode().run()"
        title="Inline Code"
      >
        <Code class="w-3.5 h-3.5" />
      </Button>

      <Separator orientation="vertical" class="mx-1 h-5" />

      <!-- Headings -->
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('heading', { level: 1 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        title="Heading 1"
      >
        <Heading1 class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('heading', { level: 2 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        title="Heading 2"
      >
        <Heading2 class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('heading', { level: 3 }) }"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        title="Heading 3"
      >
        <Heading3 class="w-3.5 h-3.5" />
      </Button>

      <Separator orientation="vertical" class="mx-1 h-5" />

      <!-- Lists -->
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('bulletList') }"
        @click="editor.chain().focus().toggleBulletList().run()"
        title="Bullet List"
      >
        <List class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('orderedList') }"
        @click="editor.chain().focus().toggleOrderedList().run()"
        title="Ordered List"
      >
        <ListOrdered class="w-3.5 h-3.5" />
      </Button>

      <Separator orientation="vertical" class="mx-1 h-5" />

      <!-- Block elements -->
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('blockquote') }"
        @click="editor.chain().focus().toggleBlockquote().run()"
        title="Blockquote"
      >
        <Quote class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': editor.isActive('codeBlock') }"
        @click="editor.chain().focus().toggleCodeBlock().run()"
        title="Code Block"
      >
        <FileCode class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        @click="editor.chain().focus().setHorizontalRule().run()"
        title="Horizontal Rule"
      >
        <Minus class="w-3.5 h-3.5" />
      </Button>

      <Separator orientation="vertical" class="mx-1 h-5" />

      <!-- Table -->
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
        title="Insert Table"
      >
        <TableIcon class="w-3.5 h-3.5" />
      </Button>

      <Separator orientation="vertical" class="mx-1 h-5" />

      <!-- Undo/Redo -->
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :disabled="!editor.can().undo()"
        @click="editor.chain().focus().undo().run()"
        title="Undo (Ctrl+Z)"
      >
        <Undo class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :disabled="!editor.can().redo()"
        @click="editor.chain().focus().redo().run()"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo class="w-3.5 h-3.5" />
      </Button>
    </div>

    <!-- Editor Content -->
    <div class="flex-1 overflow-hidden">
      <!-- Rich Text Editor -->
      <EditorContent
        v-if="editor && editorMode === 'rich'"
        :editor="editor"
        class="prd-editor-content h-full overflow-y-auto"
      />
      <!-- Markdown Split View -->
      <div
        v-else-if="editorMode === 'markdown'"
        class="h-full flex"
        :class="{ 'flex-row': showPreview, 'flex-col': !showPreview }"
      >
        <!-- Markdown Raw Editor -->
        <div :class="showPreview ? 'w-1/2 border-r border-border' : 'flex-1'" class="flex flex-col min-h-0">
          <div class="flex-shrink-0 px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 border-b border-border">
            {{ $t('generate.markdownSource') }}
          </div>
          <textarea
            ref="editorRef"
            v-model="markdownRaw"
            class="markdown-raw-editor flex-1"
            :placeholder="$t('generate.markdownPlaceholder')"
            @input="handleMarkdownInput"
            @scroll="handleEditorScroll"
          />
        </div>
        <!-- Markdown Preview -->
        <div
          v-if="showPreview"
          class="w-1/2 flex flex-col min-h-0"
        >
          <div class="flex-shrink-0 px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 border-b border-border">
            {{ $t('generate.preview') }}
          </div>
          <div
            ref="previewRef"
            class="markdown-preview flex-1 overflow-y-auto px-6 py-4"
            @scroll="handlePreviewScroll"
            v-html="renderedMarkdown"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount, onMounted, onUnmounted, ref, computed } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  Download,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  FileCode,
  Minus,
  Undo,
  Redo,
  Table as TableIcon,
  Eye,
  Maximize2,
  Minimize2,
} from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'

const { t } = useI18n()

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  'update:content': [value: string]
}>()

// Editor mode: 'rich' for rich text, 'markdown' for raw markdown
type EditorMode = 'rich' | 'markdown'
const editorMode = ref<EditorMode>('rich')

// Show preview panel in markdown mode
const showPreview = ref(true)

// Fullscreen mode
const isFullscreen = ref(false)

// Markdown raw content for raw editing mode
const markdownRaw = ref('')

// Refs for sync scroll
const editorRef = ref<HTMLTextAreaElement | null>(null)
const previewRef = ref<HTMLDivElement | null>(null)

// Flag to prevent scroll sync loop
const isScrollSyncing = ref(false)

// Flag to prevent feedback loops when setting content from prop
const isUpdatingFromProp = ref(false)

// Rendered markdown for preview
const renderedMarkdown = computed(() => {
  if (!markdownRaw.value) return ''
  const rawHtml = marked.parse(markdownRaw.value, { breaks: true, gfm: true }) as string
  if (!import.meta.client) return rawHtml
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li',
      'strong', 'em', 'code', 'pre', 'blockquote', 'table', 'thead',
      'tbody', 'tr', 'th', 'td', 'a', 'hr', 'mark'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
  })
})

const editor = useEditor({
  content: props.content || '',
  contentType: 'markdown',
  extensions: [
    StarterKit.configure({
      link: {
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      },
    }),
    Markdown,
    Placeholder.configure({
      placeholder: () => t('generate.editorPlaceholder'),
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableCell,
    TableHeader,
  ],
  editorProps: {
    attributes: {
      class: 'prd-editor-content-inner focus:outline-none px-6 py-6 min-h-full',
    },
  },
  onUpdate: ({ editor: ed }) => {
    if (isUpdatingFromProp.value) return
    const markdown = ed.getMarkdown()
    emit('update:content', markdown)
  },
})

// Switch to markdown mode - sync content from rich editor
function switchToMarkdown() {
  if (editorMode.value === 'markdown') return
  // Get current content from rich editor
  markdownRaw.value = editor.value?.getMarkdown() || props.content || ''
  editorMode.value = 'markdown'
}

// Handle markdown raw input changes
function handleMarkdownInput() {
  emit('update:content', markdownRaw.value)
}

// Sync scroll between editor and preview
function handleEditorScroll() {
  if (isScrollSyncing.value || !editorRef.value || !previewRef.value) return
  isScrollSyncing.value = true

  const editorEl = editorRef.value
  const previewEl = previewRef.value

  // Calculate scroll percentage
  const editorScrollRatio = editorEl.scrollTop / (editorEl.scrollHeight - editorEl.clientHeight)
  const targetScrollTop = editorScrollRatio * (previewEl.scrollHeight - previewEl.clientHeight)

  previewEl.scrollTop = targetScrollTop

  requestAnimationFrame(() => {
    isScrollSyncing.value = false
  })
}

function handlePreviewScroll() {
  if (isScrollSyncing.value || !editorRef.value || !previewRef.value) return
  isScrollSyncing.value = true

  const editorEl = editorRef.value
  const previewEl = previewRef.value

  // Calculate scroll percentage
  const previewScrollRatio = previewEl.scrollTop / (previewEl.scrollHeight - previewEl.clientHeight)
  const targetScrollTop = previewScrollRatio * (editorEl.scrollHeight - editorEl.clientHeight)

  editorEl.scrollTop = targetScrollTop

  requestAnimationFrame(() => {
    isScrollSyncing.value = false
  })
}

// Watch content prop changes (e.g., from AI generation)
watch(
  () => props.content,
  (newContent) => {
    // Update markdown raw if in markdown mode
    if (editorMode.value === 'markdown') {
      if (newContent !== markdownRaw.value) {
        markdownRaw.value = newContent || ''
      }
      return
    }

    // Update rich editor
    if (!editor.value) return
    // Only update if content actually changed (avoid infinite loops)
    const currentMarkdown = editor.value.getMarkdown()
    if (newContent === currentMarkdown) return

    isUpdatingFromProp.value = true
    editor.value.commands.setContent(newContent || '', {
      emitUpdate: false,
      contentType: 'markdown',
    })
    isUpdatingFromProp.value = false
  }
)

// Sync content when switching back to rich text mode
watch(editorMode, (newMode, oldMode) => {
  if (newMode === 'rich' && oldMode === 'markdown') {
    // Sync markdown raw content back to rich editor
    isUpdatingFromProp.value = true
    editor.value?.commands.setContent(markdownRaw.value || '', {
      emitUpdate: false,
      contentType: 'markdown',
    })
    isUpdatingFromProp.value = false
  }
})

function downloadPrd () {
  const markdown = editorMode.value === 'markdown'
    ? markdownRaw.value
    : (editor.value?.getMarkdown() || props.content)
  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdown))
  element.setAttribute('download', `PRD-${new Date().toISOString().split('T')[0]}.md`)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

// Handle Escape key to exit fullscreen
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isFullscreen.value) {
      isFullscreen.value = false
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
.markdown-raw-editor {
  width: 100%;
  padding: 1rem 1.5rem;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: inherit;
}

.markdown-raw-editor::placeholder {
  color: hsl(var(--muted-foreground));
  opacity: 0.6;
}

.markdown-preview {
  font-size: 0.875rem;
  line-height: 1.7;
}

.markdown-preview :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid hsl(var(--border));
}

.markdown-preview :deep(h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem;
}

.markdown-preview :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
}

.markdown-preview :deep(h4) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0.875rem 0 0.5rem;
}

.markdown-preview :deep(p) {
  margin: 0.5rem 0;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.markdown-preview :deep(ul) {
  list-style-type: disc;
}

.markdown-preview :deep(ol) {
  list-style-type: decimal;
}

.markdown-preview :deep(li) {
  margin: 0.25rem 0;
}

.markdown-preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.8rem;
  background: hsl(var(--muted));
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.markdown-preview :deep(pre) {
  background: hsl(var(--muted));
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.markdown-preview :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-preview :deep(blockquote) {
  border-left: 3px solid hsl(var(--border));
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: hsl(var(--muted-foreground));
  font-style: italic;
}

.markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid hsl(var(--border));
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.markdown-preview :deep(th) {
  background: hsl(var(--muted));
  font-weight: 600;
}

.markdown-preview :deep(hr) {
  border: none;
  border-top: 1px solid hsl(var(--border));
  margin: 1.5rem 0;
}

.markdown-preview :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}

.markdown-preview :deep(a:hover) {
  text-decoration: none;
}
</style>
