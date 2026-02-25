<template>
  <div>
  <NuxtLayout :name="layoutName">
  <div class="generate-page flex flex-col" :style="{ height: isImmersive ? '100vh' : 'calc(100vh - 86px)' }">
    <div class="max-w-[1800px] mx-auto px-6 pb-4 flex-1 flex flex-col min-h-0 w-full" :class="isImmersive ? 'pt-4' : 'pt-2'">
      <!-- Header with Status Badges -->
      <div class="flex items-center justify-between flex-shrink-0 mb-2" :class="{ 'pl-14': isImmersive }">
        <div class="flex items-center gap-3">
          <Badge variant="secondary" class="gap-2">
            <Sparkles class="w-3 h-3" />
            {{ $t('generate.knowledgeBaseActive') }}
          </Badge>
          <Badge v-if="conversationRef.messages.length > 0" variant="outline" class="gap-2">
            <Cpu class="w-3 h-3" />
            {{ $t('generate.ragEngine') }}
          </Badge>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="conversationRef.messages.length > 0"
            variant="outline"
            size="sm"
            @click="handleReset"
            class="gap-2"
          >
            <RotateCcw class="w-4 h-4" />
            {{ $t('generate.reset') }}
          </Button>
          <Button
            v-if="conversationRef.currentPrdContent"
            variant="default"
            size="sm"
            class="gap-2"
            @click="showExportDialog = true"
          >
            <Download class="w-4 h-4" />
            {{ $t('generate.exportDeliverable') }}
          </Button>
          <template v-if="isImmersive">
            <div class="w-px h-5 bg-border mx-1" />
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              @click="toggleDark"
            >
              <Moon v-if="isDark" class="w-4 h-4" />
              <Sun v-else class="w-4 h-4" />
            </Button>
          </template>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
        <!-- Chat Column -->
        <Card
          class="flex flex-col overflow-hidden transition-all duration-300"
          :class="previewVisible ? 'lg:w-[40%]' : 'lg:w-full'"
        >
          <MessageList
            :messages="conversationRef.messages"
            @retry="handleRetry"
            @back="handleBack"
          />
          <MessageInput
            :is-loading="isGenerating"
            :available-models="availableModels"
            :workspace-id="workspace.currentWorkspaceId.value ?? undefined"
            @send="handleSendMessage"
          />
        </Card>

        <!-- PRD Preview Column with Tabs -->
        <Card
          v-if="previewVisible"
          class="hidden lg:flex flex-col overflow-hidden lg:flex-1 relative transition-all duration-300"
        >
          <!-- Toggle Preview Button -->
          <Button
            variant="ghost"
            size="sm"
            class="absolute top-4 right-4 z-10 gap-2 bg-card/80 backdrop-blur-sm hover:bg-accent"
            @click="previewVisible = false"
          >
            <PanelRightClose class="w-4 h-4" />
            {{ $t('generate.hidePreview') }}
          </Button>

          <Tabs v-model="activeTab" class="flex-1 flex flex-col overflow-hidden">
            <div class="border-b border-border px-6 py-3">
              <TabsList>
                <TabsTrigger value="editor">{{ $t('generate.documentEditor') }}</TabsTrigger>
                <TabsTrigger value="prototype">{{ $t('prototype.title') }}</TabsTrigger>
                <TabsTrigger value="logic">{{ $t('generate.logicMap') }}</TabsTrigger>
                <TabsTrigger value="assets">{{ $t('generate.assets') }}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="editor" class="flex-1 overflow-hidden mt-0">
              <PRDPreview :content="conversationRef.currentPrdContent || ''" @update:content="handlePrdContentUpdate" />
            </TabsContent>
            <TabsContent value="prototype" class="flex-1 overflow-hidden mt-0">
              <PrototypeTab
                :prd-content="conversationRef.currentPrdContent"
                :prd-id="conversationRef.dbId"
                :available-models="availableModels"
                :selected-model-id="lastUsedModelId"
                @update:prd-id="handlePrdIdUpdate"
              />
            </TabsContent>
            <TabsContent value="logic" class="flex-1 overflow-hidden mt-0">
              <LogicMapTab
                :prd-content="conversationRef.currentPrdContent"
                :prd-id="conversationRef.dbId"
                :available-models="availableModels"
                :selected-model-id="lastUsedModelId"
                @update:prd-id="handlePrdIdUpdate"
              />
            </TabsContent>
            <TabsContent value="assets" class="flex-1 overflow-hidden mt-0">
              <AssetsTab
                :prd-content="conversationRef.currentPrdContent"
                :prd-id="conversationRef.dbId || null"
                :available-models="availableModels"
                :selected-model-id="lastUsedModelId"
              />
            </TabsContent>
          </Tabs>
        </Card>

        <!-- Show Preview Button (when hidden) -->
        <div
          v-else
          class="hidden lg:flex items-center justify-center"
        >
          <Button
            variant="outline"
            class="gap-2"
            @click="previewVisible = true"
          >
            <PanelRightOpen class="w-4 h-4" />
            {{ $t('generate.showPreview') }}
          </Button>
        </div>
      </div>

    </div>

    <!-- Export Deliverables Dialog -->
    <Dialog v-model:open="showExportDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ $t('generate.exportDialog.title') }}</DialogTitle>
          <DialogDescription>{{ $t('generate.exportDialog.description') }}</DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <!-- PRD Document -->
          <label class="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
            <Checkbox v-model="exportOptions.prd" class="mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <FileText class="w-4 h-4 text-primary flex-shrink-0" />
                <span class="text-sm font-medium">{{ $t('generate.exportDialog.prdDocument') }}</span>
              </div>
              <p class="text-xs text-muted-foreground mt-1">{{ $t('generate.exportDialog.prdDocumentDesc') }}</p>
            </div>
          </label>

          <!-- Prototype Pages -->
          <div class="rounded-lg border border-border">
            <div class="flex items-center justify-between p-3">
              <div class="flex items-center gap-2">
                <Layout class="w-4 h-4 text-primary" />
                <span class="text-sm font-medium">{{ $t('generate.exportDialog.prototypePages') }}</span>
              </div>
              <button
                v-if="prototypePages.length > 0"
                class="text-xs text-primary hover:underline"
                @click="toggleSelectAllPages"
              >
                {{ $t('generate.exportDialog.selectAll') }}
              </button>
            </div>

            <div v-if="prototypePages.length > 0" class="border-t border-border px-3 pb-3 pt-2 space-y-2">
              <label
                v-for="page in prototypePages"
                :key="page.pageSlug"
                class="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  :model-value="exportOptions.selectedPages.includes(page.pageSlug)"
                  @update:model-value="(val: boolean | 'indeterminate') => togglePage(page.pageSlug, val === true)"
                />
                <span class="text-sm">{{ page.pageName }}</span>
                <span class="text-xs text-muted-foreground ml-auto">.html</span>
              </label>
            </div>
            <div v-else class="border-t border-border p-3">
              <p class="text-xs text-muted-foreground">{{ $t('generate.exportDialog.noPrototype') }}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showExportDialog = false">{{ $t('common.cancel') }}</Button>
          <Button
            :disabled="isExporting || (!exportOptions.prd && exportOptions.selectedPages.length === 0)"
            @click="handleExport"
            class="gap-2"
          >
            <Loader2 v-if="isExporting" class="w-4 h-4 animate-spin" />
            <Download v-else class="w-4 h-4" />
            {{ isExporting ? $t('generate.exportDialog.exporting') : $t('common.export') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Reset Confirmation Dialog -->
    <Dialog v-model:open="resetDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t('generate.resetDialogTitle') }}</DialogTitle>
          <DialogDescription>{{ $t('generate.resetDialogDescription') }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="resetDialogOpen = false">
            {{ $t('common.cancel') }}
          </Button>
          <Button variant="destructive" @click="confirmReset">
            {{ $t('generate.reset') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  </NuxtLayout>
  </div>
</template>

<style>
/* 隐藏 body 滚动条，仅在 generate 页面 */
body:has(.generate-page) {
  overflow: hidden;
}
</style>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { RotateCcw, Download, Sparkles, Cpu, PanelRightClose, PanelRightOpen, FileText, Layout, Loader2, Moon, Sun } from 'lucide-vue-next'
import { useConversation } from '~/composables/useConversation'
import { useAiModels } from '~/composables/useAiModels'
import { usePrototype } from '~/composables/usePrototype'
import { useLogicMap } from '~/composables/useLogicMap'
import { useAssets } from '~/composables/useAssets'
import MessageList from '~/components/chat/MessageList.vue'
import MessageInput from '~/components/chat/MessageInput.vue'
import PRDPreview from '~/components/chat/PRDPreview.vue'
import PrototypeTab from '~/components/prototype/PrototypeTab.vue'
import LogicMapTab from '~/components/logic-map/LogicMapTab.vue'
import AssetsTab from '~/components/assets/AssetsTab.vue'
import { Badge } from '~/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '~/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog'
import { Checkbox } from '~/components/ui/checkbox'
import { useToast } from '~/components/ui/toast/use-toast'
import LanguageSwitcher from '~/components/common/LanguageSwitcher.vue'
import { useWorkspace } from '~/composables/useWorkspace'
import type { ConversationTargetType, ConversationMessage } from '~/types/conversation'

const { t } = useI18n()
const { toast } = useToast()
const route = useRoute()
const workspace = useWorkspace()

const isImmersive = computed(() => route.query.immersive === '1')
const layoutName = computed(() => isImmersive.value ? 'chat' : 'dashboard')

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleDark() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

definePageMeta({
  layout: false,
  middleware: ['auth']
})

const conversation = useConversation()
const aiModels = useAiModels()
const prototypeState = usePrototype()
const logicMapState = useLogicMap()
const assetsState = useAssets()
const isGenerating = ref(false)
const activeTab = ref('editor')
const previewVisible = ref(false)
const lastUsedModelId = ref('')

// Export dialog state
const showExportDialog = ref(false)
const resetDialogOpen = ref(false)
const isExporting = ref(false)
const exportOptions = reactive({
  prd: true,
  selectedPages: [] as string[]
})

// Prototype pages available for export
const prototypePages = computed(() => prototypeState.pages.value)

// Load data on mount
onMounted(async () => {
  const loadPrdId = route.query.loadPrd as string
  const isNewProject = route.query.new === '1'

  // 检查是否需要从数据库加载对话
  if (loadPrdId) {
    const loaded = await conversation.loadFromDatabase(loadPrdId)
    if (loaded) {
      toast({
        title: t('generate.loadSuccess.title'),
        description: t('generate.loadSuccess.description'),
        variant: 'success',
      })
    } else {
      toast({
        title: t('generate.loadError.title'),
        description: t('generate.loadError.description'),
        variant: 'destructive',
      })
    }
  } else if (isNewProject) {
    // 新建项目:重置对话、原型、逻辑图谱和资源管理数据
    conversation.reset()
    prototypeState.reset()
    logicMapState.reset()
    assetsState.reset()
  } else {
    // 没有 loadPrd 参数且不是新建项目,从 localStorage 加载
    conversation.loadFromStorage()
  }

  // 提前加载原型图数据，确保导出时可用（不依赖 PrototypeTab 的挂载）
  if (!isNewProject) {
    prototypeState.loadFromStorage()
    // 如果有 prdId 且 localStorage 中没有原型数据，尝试从服务端加载
    const prdId = loadPrdId || conversation.conversation.value.dbId
    if (prdId && prototypeState.pages.value.length === 0) {
      await prototypeState.loadByPrdId(prdId)
    }
  }

  await aiModels.fetchAvailableModels()
})

// Auto-show preview when PRD content is generated or user starts editing
watch(() => conversation.conversation.value.currentPrdContent, (newContent) => {
  if (newContent && !previewVisible.value) {
    previewVisible.value = true
  }
})

const availableModels = computed(() =>
  aiModels.models.value?.map(m => ({ id: m.id, label: m.name })) || []
)

// Expose conversation ref for template
const conversationRef = conversation.conversation

async function handleSendMessage (
  message: string,
  options: { modelId: string; useRAG: boolean; target: ConversationTargetType; documentIds: string[]; prdIds: string[] }
) {
  // 切换对话目标（如果改变了）
  if (options.target !== conversation.currentTarget.value) {
    conversation.switchTarget(options.target)
  }

  // Add user message
  conversation.addUserMessage(message, {
    modelUsed: options.modelId,
    useRAG: options.useRAG,
    documentIds: options.documentIds?.length > 0 ? options.documentIds : undefined
  })

  lastUsedModelId.value = options.modelId

  // Create AI message placeholder
  const aiMessage = conversation.addAIMessage({
    modelUsed: options.modelId,
    useRAG: options.useRAG
  })

  isGenerating.value = true

  try {
    // 构建历史消息（排除刚添加的 user 消息和 AI 占位消息）
    const allMessages = conversationRef.value.messages
    const history = allMessages.slice(0, allMessages.length - 2) // 排除本轮的 user + AI 占位

    // Stream the response
    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: history.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp
        })),
        modelId: options.modelId,
        useRAG: options.useRAG,
        target: options.target,
        documentIds: options.documentIds?.length > 0 ? options.documentIds : undefined,
        prdIds: options.prdIds?.length > 0 ? options.prdIds : undefined,
        // 原型目标时传递当前 HTML 上下文
        targetContext: options.target === 'prototype' ? {
          prototypeHtml: conversation.targetContext.value?.prototypeHtml
        } : undefined
      })
    })

    if (!response.ok) throw new Error(t('generate.errors.generateFailed'))

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) throw new Error(t('generate.errors.noResponse'))

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        if (buffer.trim()) {
          console.warn('Incomplete chunk in buffer:', buffer)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Process all complete lines, keep incomplete last line in buffer
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i]
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.chunk) {
              conversation.updateAIMessage(aiMessage.id, data.chunk)
            }
            if (data.done) {
              // 如果返回了完整的PRD内容，更新到currentPrdContent
              if (data.isPRD && data.fullContent) {
                conversationRef.value.currentPrdContent = data.fullContent
              }
              conversation.completeAIMessage(aiMessage.id)
              return
            }
          } catch (e) {
            console.error('Failed to parse stream data:', e)
          }
        }
      }

      // Keep the last incomplete line in buffer for next iteration
      buffer = lines[lines.length - 1] || ''
    }
  } catch (error) {
    console.error('Generation error:', error)
    conversation.updateAIMessage(
      aiMessage.id,
      '\n\n' + t('generate.errors.generationError')
    )
    conversation.completeAIMessage(aiMessage.id)
  } finally {
    isGenerating.value = false

    // 自动保存到数据库
    try {
      await conversation.autoSaveToDatabase()
    } catch (error) {
      console.error('Auto-save failed:', error)
      toast({
        title: t('generate.autoSaveError.title'),
        description: t('generate.autoSaveError.description'),
        variant: 'destructive',
      })
    }
  }
}

function handlePrdContentUpdate (content: string) {
  conversationRef.value.currentPrdContent = content
  conversation.saveToStorage()
}

function handlePrdIdUpdate (prdId: string) {
  conversationRef.value.dbId = prdId
  conversationRef.value.savedToDb = true
  conversation.saveToStorage()
}

function handleReset () {
  resetDialogOpen.value = true
}

function confirmReset () {
  conversation.reset()
  prototypeState.reset()
  logicMapState.reset()
  assetsState.reset()
  resetDialogOpen.value = false
}

function togglePage (slug: string, checked: boolean) {
  if (checked) {
    if (!exportOptions.selectedPages.includes(slug)) {
      exportOptions.selectedPages.push(slug)
    }
  } else {
    exportOptions.selectedPages = exportOptions.selectedPages.filter(s => s !== slug)
  }
}

function toggleSelectAllPages () {
  const allSlugs = prototypePages.value.map(p => p.pageSlug)
  if (exportOptions.selectedPages.length === allSlugs.length) {
    exportOptions.selectedPages = []
  } else {
    exportOptions.selectedPages = [...allSlugs]
  }
}

async function handleExport () {
  if (!exportOptions.prd && exportOptions.selectedPages.length === 0) {
    toast({
      title: t('generate.exportDialog.nothingSelected'),
      variant: 'destructive'
    })
    return
  }

  isExporting.value = true

  try {
    const hasPrototypePages = exportOptions.selectedPages.length > 0
    const title = conversationRef.value.title || t('defaults.archMind')
    const dateSuffix = new Date().toISOString().split('T')[0]

    // Only PRD, no prototype pages → download as single .md file
    if (exportOptions.prd && !hasPrototypePages) {
      const markdown = conversationRef.value.currentPrdContent
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      downloadBlob(blob, `${title}-PRD-${dateSuffix}.md`)
    }
    // Only prototype pages, no PRD → single page = .html, multiple = .zip
    else if (!exportOptions.prd && hasPrototypePages) {
      const selectedPageData = prototypePages.value.filter(p =>
        exportOptions.selectedPages.includes(p.pageSlug)
      )
      if (selectedPageData.length === 1) {
        const page = selectedPageData[0]
        const blob = new Blob([page.htmlContent], { type: 'text/html;charset=utf-8' })
        downloadBlob(blob, `${page.pageName}.html`)
      } else {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        for (const page of selectedPageData) {
          zip.file(`${page.pageName}.html`, page.htmlContent)
        }
        const content = await zip.generateAsync({ type: 'blob' })
        downloadBlob(content, `${title}-Prototype-${dateSuffix}.zip`)
      }
    }
    // Both PRD + prototype pages → always .zip
    else {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      // Add PRD
      zip.file('PRD.md', conversationRef.value.currentPrdContent)

      // Add prototype pages
      const prototypeFolder = zip.folder('prototype')!
      const selectedPageData = prototypePages.value.filter(p =>
        exportOptions.selectedPages.includes(p.pageSlug)
      )
      for (const page of selectedPageData) {
        prototypeFolder.file(`${page.pageName}.html`, page.htmlContent)
      }

      const content = await zip.generateAsync({ type: 'blob' })
      downloadBlob(content, `${title}-${dateSuffix}.zip`)
    }

    toast({
      title: t('generate.exportDialog.exportSuccess'),
      description: t('generate.exportDialog.exportSuccessDesc'),
      variant: 'success',
    })
    showExportDialog.value = false
  } catch (error) {
    console.error('Export failed:', error)
    toast({
      title: t('generate.exportDialog.exportFailed'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  } finally {
    isExporting.value = false
  }
}

function downloadBlob (blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Handle retry - resend a user message
async function handleRetry (message: ConversationMessage) {
  if (message.role !== 'user') return

  // Delete all messages from this one onwards
  conversation.deleteMessagesFrom(message.id)

  // Get the model ID from the original message or use the last used one
  const modelId = message.modelUsed || lastUsedModelId.value || availableModels.value[0]?.id
  if (!modelId) return

  // Resend the message
  await handleSendMessage(message.content, {
    modelId,
    useRAG: message.useRAG ?? true,
    target: conversation.currentTarget.value,
    documentIds: message.documentIds || [],
    prdIds: []
  })
}

// Handle back - delete messages from this point onwards
function handleBack (message: ConversationMessage) {
  conversation.deleteMessagesFrom(message.id)
}
</script>
