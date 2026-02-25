<template>
  <div class="flex flex-col" style="height: calc(100vh - 96px);">
    <!-- Sticky Header -->
    <div class="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
      <div class="max-w-[1400px] mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <Button variant="ghost" size="icon" @click="router.back()">
              <ArrowLeft class="w-4 h-4" />
            </Button>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-xl font-bold tracking-tight">{{ prd?.title }}</h1>
                <Badge variant="secondary" class="text-xs">
                  {{ prd?.modelUsed || 'AI' }}
                </Badge>
              </div>
              <div class="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span class="flex items-center gap-1">
                  <Calendar class="w-3.5 h-3.5" />
                  {{ formatDate(prd?.createdAt) }}
                </span>
                <span v-if="conversationMessages.length > 0" class="flex items-center gap-1">
                  <MessageCircle class="w-3.5 h-3.5" />
                  {{ conversationMessages.length }} {{ $t('projects.details.messageCount') }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Primary CTA: Continue Conversation -->
            <Button @click="handleContinueConversation" class="gap-2">
              <MessageSquarePlus class="w-4 h-4" />
              {{ $t('projects.details.continueConversation') }}
            </Button>
            <!-- View Prototype -->
            <Button
              v-if="prototypeData"
              variant="outline"
              @click="handleViewPrototype"
              class="gap-2"
            >
              <Layout class="w-4 h-4" />
              {{ $t('projects.details.viewPrototype') }}
            </Button>
            <!-- More Actions -->
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon">
                  <MoreVertical class="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="handleExport">
                  <Download class="w-4 h-4 mr-2" />
                  {{ $t('projects.details.actions.exportMarkdown') }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-destructive" @click="handleDelete">
                  <Trash2 class="w-4 h-4 mr-2" />
                  {{ $t('projects.details.actions.delete') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-[1400px] mx-auto px-6 py-6">
        <!-- Loading State: 骨架屏 -->
        <div v-if="isLoading" class="space-y-6">
          <!-- 概览卡片骨架 -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card v-for="i in 4" :key="i">
              <CardContent class="p-4">
                <div class="flex items-center gap-3">
                  <Skeleton class="w-9 h-9 rounded-lg" />
                  <div class="space-y-2 flex-1">
                    <Skeleton class="h-3 w-20" />
                    <Skeleton class="h-4 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <!-- 主内容骨架 -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 space-y-4">
              <Skeleton class="h-8 w-48" />
              <Skeleton class="h-4 w-full" />
              <Skeleton class="h-4 w-5/6" />
              <Skeleton class="h-4 w-4/6" />
              <Skeleton class="h-4 w-full" />
              <Skeleton class="h-4 w-3/4" />
            </div>
            <div class="space-y-4">
              <Skeleton class="h-8 w-32" />
              <Skeleton class="h-20 w-full rounded-lg" />
              <Skeleton class="h-20 w-full rounded-lg" />
            </div>
          </div>
        </div>

        <template v-else-if="prd">
          <!-- Overview Cards Row -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent class="p-4">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                    <FileText class="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">{{ $t('projects.details.prdContent') }}</p>
                    <p class="font-semibold text-sm">{{ contentWordCount }} {{ $t('projects.details.words') }}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent class="p-4">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <MessageCircle class="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">{{ $t('projects.details.conversations') }}</p>
                    <p class="font-semibold text-sm">{{ conversationMessages.length }} {{ $t('projects.details.rounds') }}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent class="p-4">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Layout class="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">{{ $t('prototype.title') }}</p>
                    <p class="font-semibold text-sm">
                      {{ prototypeData ? $t('projects.details.generated') : $t('projects.details.notGenerated') }}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent class="p-4">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <BookOpen class="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">{{ $t('projects.details.references') }}</p>
                    <p class="font-semibold text-sm">{{ references.length }} {{ $t('projects.details.docs') }}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- Main Content: Two-column layout -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Column: PRD Content (2/3 width) -->
            <div class="lg:col-span-2 space-y-6">
              <!-- PRD Document -->
              <Card>
                <CardHeader class="pb-3">
                  <div class="flex items-center justify-between">
                    <CardTitle class="text-base flex items-center gap-2">
                      <FileText class="w-4 h-4 text-primary" />
                      {{ $t('projects.details.prdDocument') }}
                    </CardTitle>
                    <div class="flex items-center gap-2">
                      <Button variant="outline" size="sm" @click="handleEditPrd" class="gap-1.5 text-xs">
                        <Edit class="w-3.5 h-3.5" />
                        {{ $t('projects.details.edit') }}
                      </Button>
                      <Button variant="ghost" size="sm" @click="handleExport" class="gap-1.5 text-xs">
                        <Download class="w-3.5 h-3.5" />
                        {{ $t('common.export') }}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    class="prose prose-sm prose-slate dark:prose-invert max-w-none"
                    :class="{ 'max-h-[600px] overflow-hidden relative': !prdExpanded }"
                  >
                    <div v-html="renderedContent"></div>
                    <!-- Gradient overlay when collapsed -->
                    <div
                      v-if="!prdExpanded && isContentLong"
                      class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-card to-transparent"
                    />
                  </div>
                  <div v-if="isContentLong" class="flex justify-center mt-4 pt-2 border-t border-border">
                    <Button variant="ghost" size="sm" @click="prdExpanded = !prdExpanded" class="gap-1.5 text-xs">
                      <ChevronDown
                        class="w-3.5 h-3.5 transition-transform duration-200"
                        :class="{ 'rotate-180': prdExpanded }"
                      />
                      {{ prdExpanded ? $t('projects.details.collapseContent') : $t('projects.details.expandAll') }}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <!-- Prototype Preview (if exists) -->
              <Card v-if="prototypeData && prototypePages.length > 0">
                <CardHeader class="pb-3">
                  <div class="flex items-center justify-between">
                    <CardTitle class="text-base flex items-center gap-2">
                      <Layout class="w-4 h-4 text-green-500" />
                      {{ $t('prototype.title') }}
                      <Badge variant="secondary" class="text-xs">
                        {{ prototypePages.length }} {{ $t('projects.details.pagesCount') }}
                      </Badge>
                    </CardTitle>
                    <Button variant="outline" size="sm" @click="handleViewPrototype" class="gap-1.5 text-xs">
                      <Maximize2 class="w-3.5 h-3.5" />
                      {{ $t('prototype.fullscreen') }}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <!-- Page tabs for prototype -->
                  <div v-if="prototypePages.length > 1" class="flex gap-1.5 mb-3">
                    <Button
                      v-for="page in prototypePages"
                      :key="page.pageSlug"
                      :variant="activePrototypePage === page.pageSlug ? 'default' : 'outline'"
                      size="sm"
                      class="text-xs h-7"
                      @click="activePrototypePage = page.pageSlug"
                    >
                      {{ page.pageName }}
                    </Button>
                  </div>
                  <!-- Prototype iframe preview -->
                  <div class="border border-border rounded-lg overflow-hidden bg-white" style="height: 480px;">
                    <iframe
                      :srcdoc="activePrototypeHtml"
                      sandbox="allow-scripts allow-forms allow-popups"
                      class="w-full h-full border-0"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <!-- Right Column: Sidebar (1/3 width) -->
            <div class="space-y-6">
              <!-- Conversation Summary -->
              <Card>
                <CardHeader class="pb-3">
                  <div class="flex items-center justify-between">
                    <CardTitle class="text-base flex items-center gap-2">
                      <MessageCircle class="w-4 h-4 text-blue-500" />
                      {{ $t('projects.details.conversation') }}
                    </CardTitle>
                    <Button
                      v-if="conversationMessages.length > 0"
                      variant="ghost"
                      size="sm"
                      @click="handleContinueConversation"
                      class="gap-1.5 text-xs"
                    >
                      <MessageSquarePlus class="w-3.5 h-3.5" />
                      {{ $t('projects.details.continue') }}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div v-if="conversationMessages.length === 0" class="text-center py-6">
                    <MessageCircle class="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p class="text-sm text-muted-foreground">{{ $t('projects.details.noConversation') }}</p>
                    <Button size="sm" variant="outline" class="mt-3 gap-1.5" @click="handleContinueConversation">
                      <MessageSquarePlus class="w-3.5 h-3.5" />
                      {{ $t('projects.details.startConversation') }}
                    </Button>
                  </div>
                  <div v-else class="space-y-3">
                    <!-- Show last N messages as summary -->
                    <div
                      v-for="message in displayedMessages"
                      :key="message.id"
                      class="flex gap-2.5"
                    >
                      <div
                        class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        :class="message.role === 'user' ? 'bg-primary/10' : 'bg-secondary'"
                      >
                        <User v-if="message.role === 'user'" class="w-3 h-3 text-primary" />
                        <Sparkles v-else class="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs text-muted-foreground mb-0.5">
                          {{ message.role === 'user' ? $t('projects.details.user') : $t('projects.details.assistant') }}
                        </p>
                        <p class="text-sm line-clamp-3 text-foreground/80">
                          {{ stripMarkdown(message.content) }}
                        </p>
                      </div>
                    </div>
                    <!-- Show more toggle -->
                    <div v-if="conversationMessages.length > displayMessageCount" class="pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="w-full text-xs gap-1"
                        @click="showAllMessages = !showAllMessages"
                      >
                        <ChevronDown
                          class="w-3.5 h-3.5 transition-transform duration-200"
                          :class="{ 'rotate-180': showAllMessages }"
                        />
                        {{ showAllMessages
                          ? $t('projects.details.showLess')
                          : $t('projects.details.showMore', { count: conversationMessages.length - displayMessageCount })
                        }}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <!-- Metadata -->
              <Card>
                <CardHeader class="pb-3">
                  <CardTitle class="text-base flex items-center gap-2">
                    <Info class="w-4 h-4 text-muted-foreground" />
                    {{ $t('projects.details.metadata') }}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-3">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-muted-foreground">{{ $t('projects.details.model') }}</span>
                      <Badge variant="outline" class="text-xs">{{ prd?.modelUsed || 'N/A' }}</Badge>
                    </div>
                    <Separator />
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-muted-foreground">{{ $t('projects.details.createdAt') }}</span>
                      <span class="font-medium text-xs">{{ formatDateTime(prd?.createdAt) }}</span>
                    </div>
                    <Separator />
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-muted-foreground">{{ $t('projects.details.updatedAt') }}</span>
                      <span class="font-medium text-xs">{{ formatDateTime(prd?.updatedAt) }}</span>
                    </div>
                    <template v-if="prd?.userInput">
                      <Separator />
                      <div>
                        <span class="text-sm text-muted-foreground block mb-1.5">{{ $t('projects.details.userInput') }}</span>
                        <p class="text-sm bg-muted/50 rounded-md p-2.5 text-foreground/80 leading-relaxed">
                          {{ prd.userInput }}
                        </p>
                      </div>
                    </template>
                  </div>
                </CardContent>
              </Card>

              <!-- RAG 知识库设置 -->
              <Card>
                <CardHeader class="pb-3">
                  <CardTitle class="text-base flex items-center gap-2">
                    <Brain class="w-4 h-4 text-violet-500" />
                    {{ $t('projects.details.ragTitle') }}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-3">
                    <p class="text-xs text-muted-foreground leading-relaxed">
                      {{ $t('projects.details.ragDescription') }}
                    </p>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <Switch
                          :checked="ragEnabled"
                          :disabled="ragLoading || ragStatus === 'processing'"
                          @update:checked="handleRagToggle"
                        />
                        <span class="text-sm font-medium">
                          {{ ragEnabled ? $t('projects.details.ragEnabled') : $t('projects.details.ragDisabled') }}
                        </span>
                      </div>
                      <!-- 状态指示 -->
                      <div v-if="ragStatus === 'processing'" class="flex items-center gap-1.5">
                        <Loader2 class="w-3.5 h-3.5 animate-spin text-violet-500" />
                        <span class="text-xs text-muted-foreground">{{ $t('projects.details.ragProcessing') }}</span>
                      </div>
                      <Badge
                        v-else-if="ragEnabled && ragStatus === 'completed'"
                        variant="outline"
                        class="text-[10px] border-violet-300 text-violet-600 bg-violet-50"
                      >
                        {{ $t('projects.details.ragReady') }}
                      </Badge>
                      <Badge
                        v-else-if="ragStatus === 'failed'"
                        variant="outline"
                        class="text-[10px] border-red-300 text-red-600"
                      >
                        {{ $t('projects.details.ragFailed') }}
                      </Badge>
                    </div>
                    <p v-if="ragEnabled" class="text-[11px] text-violet-600/70 bg-violet-50 rounded-md px-2.5 py-1.5">
                      {{ $t('projects.details.ragHint') }}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <!-- Referenced Documents -->
              <Card v-if="references.length > 0">
                <CardHeader class="pb-3">
                  <CardTitle class="text-base flex items-center gap-2">
                    <BookOpen class="w-4 h-4 text-orange-500" />
                    {{ $t('projects.details.references') }}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-2">
                    <div
                      v-for="ref in references"
                      :key="ref.id"
                      class="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      @click="viewDocument(ref.documentId)"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <FileText class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span class="text-sm truncate">{{ ref.documentTitle }}</span>
                      </div>
                      <Badge variant="secondary" class="text-xs flex-shrink-0">
                        {{ Math.round((ref.relevanceScore || 0) * 100) }}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t('projects.deleteConfirm') }}</DialogTitle>
          <DialogDescription>
            {{ $t('projects.deleteConfirmDescription') }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteDialogOpen = false">
            {{ $t('common.cancel') }}
          </Button>
          <Button variant="destructive" @click="confirmDelete">
            {{ $t('common.delete') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import {
  ArrowLeft, MoreVertical, Download, Trash2, MessageSquarePlus,
  FileText, MessageCircle, Layout, BookOpen, Calendar, Info,
  ChevronDown, User, Sparkles, Maximize2, Edit, Brain, Loader2
} from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { Switch } from '~/components/ui/switch'
import { Skeleton } from '~/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog'
import { useToast } from '~/components/ui/toast/use-toast'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { toast } = useToast()

const prdId = route.params.id as string
const prd = ref<any>(null)
const references = ref<any[]>([])
const conversationMessages = ref<any[]>([])
const isLoading = ref(true)
const prdExpanded = ref(false)
const showAllMessages = ref(false)
const deleteDialogOpen = ref(false)

// Prototype data
const prototypeData = ref<any>(null)
const prototypePages = ref<any[]>([])
const activePrototypePage = ref('')

// RAG 状态
const ragLoading = ref(false)
const ragEnabled = computed(() => prd.value?.metadata?.ragEnabled === true)
const ragStatus = computed(() => prd.value?.metadata?.ragStatus as string | undefined)

// Number of messages to show in collapsed view
const displayMessageCount = 6

onMounted(async () => {
  try {
    // Load PRD details, conversation history, and prototype data in parallel
    const [prdResponse, conversationResult, prototypeResult] = await Promise.allSettled([
      $fetch<{ data: any }>(`/api/v1/prd/${prdId}`),
      $fetch<{ success: boolean; data: any }>(`/api/v1/conversations/${prdId}`),
      $fetch<{ success: boolean; data: any }>('/api/v1/prototypes', { params: { prdId } })
    ])

    if (prdResponse.status === 'fulfilled') {
      prd.value = prdResponse.value.data
      references.value = prdResponse.value.data.references || []
    }

    if (conversationResult.status === 'fulfilled' && conversationResult.value.success) {
      conversationMessages.value = conversationResult.value.data.messages || []
    }

    if (prototypeResult.status === 'fulfilled' && prototypeResult.value.success) {
      const prototypes = prototypeResult.value.data.prototypes
      if (prototypes?.length > 0) {
        prototypeData.value = prototypes[0]
        // Load prototype pages
        try {
          const pagesResponse = await $fetch<{ success: boolean; data: any }>(
            `/api/v1/prototypes/${prototypes[0].id}`
          )
          if (pagesResponse.success) {
            prototypePages.value = pagesResponse.data.pages || []
            const entryPage = prototypePages.value.find((p: any) => p.isEntryPage)
            activePrototypePage.value = entryPage?.pageSlug || prototypePages.value[0]?.pageSlug || ''
          }
        } catch {
          // ignore page load error
        }
      }
    }
  } catch (error) {
    console.error('Failed to load project data:', error)
    toast({
      title: t('projects.loadFailed'),
      variant: 'destructive',
    })
  } finally {
    isLoading.value = false
  }
})

const renderedContent = computed(() => {
  if (!prd.value?.content) return ''
  return marked(prd.value.content)
})

const contentWordCount = computed(() => {
  if (!prd.value?.content) return 0
  return prd.value.content.length
})

const isContentLong = computed(() => {
  return (prd.value?.content?.length || 0) > 1500
})

const displayedMessages = computed(() => {
  if (showAllMessages.value) return conversationMessages.value
  return conversationMessages.value.slice(0, displayMessageCount)
})

const activePrototypeHtml = computed(() => {
  const page = prototypePages.value.find((p: any) => p.pageSlug === activePrototypePage.value)
  const html = page?.htmlContent || ''
  if (!html) return ''

  // 注入脚本过滤 Tailwind CDN 的生产环境警告
  const suppressScript = `<script>(function(){var _w=console.warn;console.warn=function(){if(arguments[0]&&typeof arguments[0]==='string'&&arguments[0].indexOf('cdn.tailwindcss.com')!==-1)return;_w.apply(console,arguments)};})();<\/script>`
  if (html.includes('</head>')) {
    return html.replace('</head>', `${suppressScript}</head>`)
  } else if (html.includes('<html')) {
    return html.replace(/<html[^>]*>/, `$&${suppressScript}`)
  }
  return suppressScript + html
})

function formatDate (date: string | undefined) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN')
}

function formatDateTime (date: string | undefined) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function stripMarkdown (content: string) {
  return content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\n/g, ' ')
    .trim()
}

function viewDocument (documentId: string) {
  router.push(`/documents/${documentId}`)
}

async function handleExport () {
  if (!prd.value) return

  const blob = new Blob([prd.value.content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${prd.value.title}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function handleDelete () {
  deleteDialogOpen.value = true
}

async function confirmDelete () {
  try {
    await $fetch(`/api/v1/prd/${prdId}`, { method: 'DELETE' })
    toast({
      title: t('projects.deleteSuccess'),
      description: t('projects.deleteSuccessDescription'),
      variant: 'success',
    })
    router.push('/')
  } catch (error) {
    console.error('Failed to delete PRD:', error)
    toast({
      title: t('projects.deleteFailed'),
      variant: 'destructive',
    })
  } finally {
    deleteDialogOpen.value = false
  }
}

function handleContinueConversation () {
  router.push({
    path: '/generate',
    query: { loadPrd: prdId, immersive: '1' }
  })
}

function handleViewPrototype () {
  if (prototypeData.value) {
    router.push(`/prototype/${prototypeData.value.id}`)
  }
}

// Navigate to generate page to edit PRD
function handleEditPrd () {
  router.push({
    path: '/generate',
    query: { loadPrd: prdId, immersive: '1' }
  })
}

async function handleRagToggle (enabled: boolean) {
  if (ragLoading.value) return
  ragLoading.value = true
  try {
    if (enabled) {
      // 乐观更新 UI，立即显示 processing 状态
      if (prd.value) {
        prd.value = {
          ...prd.value,
          metadata: { ...(prd.value.metadata || {}), ragEnabled: false, ragStatus: 'processing' }
        }
      }
      await $fetch(`/api/v1/prd/${prdId}/vectorize`, { method: 'POST' })
      // 服务端后台处理，轮询状态直到完成
      pollRagStatus()
      toast({ title: t('projects.details.ragEnableSuccess') })
    } else {
      await $fetch(`/api/v1/prd/${prdId}/vectorize`, { method: 'DELETE' })
      if (prd.value) {
        prd.value = {
          ...prd.value,
          metadata: { ...(prd.value.metadata || {}), ragEnabled: false, ragStatus: undefined }
        }
      }
      toast({ title: t('projects.details.ragDisableSuccess') })
    }
  } catch (error) {
    console.error('[RAG] toggle failed:', error)
    toast({
      title: enabled ? t('projects.details.ragEnableFailed') : t('projects.details.ragDisableFailed'),
      variant: 'destructive'
    })
    // 恢复原状态
    if (prd.value) {
      prd.value = {
        ...prd.value,
        metadata: { ...(prd.value.metadata || {}), ragStatus: enabled ? 'failed' : undefined }
      }
    }
  } finally {
    ragLoading.value = false
  }
}

// 轮询 RAG 状态，直到 completed 或 failed
let ragPollTimer: ReturnType<typeof setTimeout> | null = null
function pollRagStatus () {
  if (ragPollTimer) clearTimeout(ragPollTimer)
  ragPollTimer = setTimeout(async () => {
    try {
      const res = await $fetch<{ data: any }>(`/api/v1/prd/${prdId}`)
      if (res.data) {
        prd.value = res.data
      }
      const status = res.data?.metadata?.ragStatus
      if (status === 'processing') {
        // 继续轮询
        pollRagStatus()
      }
    } catch {
      // 忽略轮询错误
    }
  }, 3000)
}

onUnmounted(() => {
  if (ragPollTimer) clearTimeout(ragPollTimer)
})
</script>
