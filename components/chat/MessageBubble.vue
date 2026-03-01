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
          <!-- User message: plain text -->
          <p v-if="message.role === 'user'" class="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {{ message.content }}
          </p>
          <!-- AI message: markdown rendered -->
          <div v-else class="message-markdown text-sm leading-relaxed break-words" v-html="renderedContent" />

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
import { Sparkles, User, BookOpen, Cpu, Loader2, Copy, Check, RefreshCw, ArrowLeftFromLine, FileText } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '~/components/ui/tooltip'
import type { ConversationMessage } from '~/types/conversation'

const props = defineProps<{
  message: ConversationMessage
}>()

const emit = defineEmits<{
  retry: [message: ConversationMessage]
  back: [message: ConversationMessage]
}>()

const copied = ref(false)

const renderedContent = computed(() => {
  if (props.message.role === 'user') return ''
  return DOMPurify.sanitize(marked.parse(props.message.content) as string)
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
