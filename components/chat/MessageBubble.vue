<template>
  <div
    class="group flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-400"
    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <!-- AI Avatar -->
    <Avatar v-if="message.role === 'assistant'" class="flex-shrink-0">
      <AvatarFallback class="bg-transparent text-primary">
        <Sparkles class="w-4 h-4" />
      </AvatarFallback>
    </Avatar>

    <!-- Message Bubble -->
    <div class="flex flex-col max-w-[65%]">
      <Card
        class="overflow-hidden"
        :class="message.role === 'user' ? 'bg-primary text-primary-foreground' : ''"
      >
        <CardContent class="p-4">
          <!-- User message: plain text + images -->
          <template v-if="message.role === 'user'">
            <!-- Images (if any) -->
            <div v-if="message.images && message.images.length > 0" class="flex flex-wrap gap-2 mb-3">
              <img
                v-for="image in message.images"
                :key="image.id"
                :src="getImagePreview(image)"
                :alt="image.name || 'Uploaded image'"
                class="max-w-[200px] max-h-[200px] rounded border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                @click="openImagePreview(image)"
              >
            </div>
            <!-- Text content -->
            <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {{ message.content }}
            </p>
          </template>
          <!-- AI message: markdown rendered -->
          <template v-else>
            <!-- Thinking block (reasoning models like GLM-4.7) -->
            <div
              v-if="message.thinkingContent || (message.isStreaming && !message.content)"
              class="mb-3 rounded-md border border-border/60 bg-muted/40 overflow-hidden"
            >
              <button
                class="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                @click="thinkingExpanded = !thinkingExpanded"
              >
                <Brain class="w-3.5 h-3.5 flex-shrink-0" />
                <span class="flex-1 text-left">{{ message.isStreaming && !message.content ? '思考中...' : '思考过程' }}</span>
                <Loader2 v-if="message.isStreaming && !message.content" class="w-3 h-3 animate-spin" />
                <ChevronDown v-else-if="thinkingExpanded" class="w-3 h-3" />
                <ChevronRight v-else class="w-3 h-3" />
              </button>
              <div v-if="thinkingExpanded && message.thinkingContent" class="px-3 pb-3">
                <div class="message-markdown text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-2" v-html="renderedThinkingContent" />
              </div>
            </div>
            <!-- Main content -->
            <div class="message-markdown text-sm leading-relaxed break-words" v-html="renderedContent" />
          </template>

          <!-- Streaming indicator -->
          <div v-if="message.isStreaming" class="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Loader2 class="w-3 h-3 animate-spin" />
            <span>{{ $t('chat.generating') }}</span>
          </div>
        </CardContent>
      </Card>

      <!-- Action Buttons & Metadata -->
      <div class="flex items-center gap-2 mt-1.5 px-1">
        <!-- Action Buttons (visible on hover) -->
        <div
          v-if="!message.isStreaming"
          class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <!-- Copy Button -->
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6"
                  @click="handleCopy"
                >
                  <Check v-if="copied" class="w-3 h-3 text-green-500" />
                  <Copy v-else class="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" class="text-xs">
                {{ copied ? $t('chat.copied') : $t('chat.copy') }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <!-- Retry Button (User messages only) -->
          <TooltipProvider v-if="message.role === 'user'" :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6"
                  @click="handleRetry"
                >
                  <RefreshCw class="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" class="text-xs">
                {{ $t('chat.retryHint') }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <!-- Back Button (Delete from here) -->
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                  @click="handleBack"
                >
                  <ArrowLeftFromLine class="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" class="text-xs">
                {{ $t('chat.backHint') }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <!-- Metadata -->
        <template v-if="message.role === 'user' && message.documentTitles?.length">
          <Badge
            v-for="title in message.documentTitles"
            :key="title"
            variant="outline"
            class="text-xs gap-1 bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
          >
            <FileText class="w-3 h-3" />
            {{ title }}
          </Badge>
        </template>
        <Badge v-if="message.modelUsed" variant="secondary" class="text-xs">
          <Cpu class="w-3 h-3 mr-1.5" />
          {{ message.modelUsed }}
        </Badge>
        <Badge v-if="message.useRAG" variant="outline" class="text-xs gap-1">
          <BookOpen class="w-3 h-3" />
          RAG
        </Badge>
        <span class="text-xs text-muted-foreground ml-auto">
          {{ formatTime(message.timestamp) }}
        </span>
      </div>
    </div>

    <!-- User Avatar -->
    <Avatar v-if="message.role === 'user'" class="flex-shrink-0">
      <AvatarFallback class="bg-transparent text-primary">
        <User class="w-4 h-4" />
      </AvatarFallback>
    </Avatar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Sparkles, User, BookOpen, Cpu, Loader2, Copy, Check, RefreshCw, ArrowLeftFromLine, FileText, ChevronDown, ChevronRight, Brain } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '~/components/ui/tooltip'
import type { ConversationMessage, ImageAttachment } from '~/types/conversation'

const props = defineProps<{
  message: ConversationMessage
}>()

const emit = defineEmits<{
  retry: [message: ConversationMessage]
  back: [message: ConversationMessage]
}>()

const copied = ref(false)
const thinkingExpanded = ref(false)

const renderedContent = computed(() => {
  if (props.message.role === 'user') return ''
  return DOMPurify.sanitize(marked.parse(props.message.content) as string)
})

const renderedThinkingContent = computed(() => {
  if (!props.message.thinkingContent) return ''
  return DOMPurify.sanitize(marked.parse(props.message.thinkingContent) as string)
})

function formatTime (timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function handleCopy () {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    console.error('Failed to copy message')
  }
}

function handleRetry () {
  emit('retry', props.message)
}

function handleBack () {
  emit('back', props.message)
}

function getImagePreview (image: ImageAttachment): string {
  if (image.type === 'base64') {
    return `data:${image.mimeType};base64,${image.data}`
  }
  return image.data
}

function openImagePreview (image: ImageAttachment) {
  // 在新窗口打开图片
  const url = getImagePreview(image)
  window.open(url, '_blank')
}

</script>

<style scoped>
/* Markdown styles for AI message bubbles */
:deep(.message-markdown > *:first-child) {
  margin-top: 0;
}

:deep(.message-markdown > *:last-child) {
  margin-bottom: 0;
}

:deep(.message-markdown h1) {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 1rem 0 0.5rem;
}

:deep(.message-markdown h2) {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0.875rem 0 0.4rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid hsl(var(--border));
}

:deep(.message-markdown h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.75rem 0 0.375rem;
}

:deep(.message-markdown h4),
:deep(.message-markdown h5),
:deep(.message-markdown h6) {
  font-weight: 600;
  margin: 0.5rem 0 0.25rem;
  font-size: 0.9rem;
}

:deep(.message-markdown p) {
  margin: 0.5rem 0;
}

:deep(.message-markdown ul),
:deep(.message-markdown ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

:deep(.message-markdown li) {
  margin: 0.2rem 0;
}

:deep(.message-markdown li p) {
  margin: 0;
}

:deep(.message-markdown code) {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

:deep(.message-markdown pre) {
  border-radius: 6px;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0.5rem 0;
  font-size: 0.8rem;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  line-height: 1.5;
}

:deep(.message-markdown pre code) {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
}

:deep(.message-markdown blockquote) {
  border-left: 3px solid hsl(var(--primary));
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
  border-radius: 0 4px 4px 0;
  background: hsl(var(--muted) / 0.5);
  color: hsl(var(--muted-foreground));
}

:deep(.message-markdown blockquote p) {
  margin: 0;
}

:deep(.message-markdown a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

:deep(.message-markdown a:hover) {
  opacity: 0.8;
}

:deep(.message-markdown table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.85rem;
}

:deep(.message-markdown th),
:deep(.message-markdown td) {
  border: 1px solid hsl(var(--border));
  padding: 0.4rem 0.6rem;
  text-align: left;
}

:deep(.message-markdown th) {
  font-weight: 600;
  background: hsl(var(--muted));
}

:deep(.message-markdown hr) {
  border: none;
  height: 1px;
  background: hsl(var(--border));
  margin: 0.75rem 0;
}

:deep(.message-markdown strong) {
  font-weight: 700;
}

:deep(.message-markdown img) {
  max-width: 100%;
  border-radius: 6px;
}
</style>
