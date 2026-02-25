<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- 工具栏 -->
    <PrototypeToolbar
      :has-prototype="effectivePages.length > 0"
      :has-prd="!!prdContent"
      :is-generating="prototypeState.isGenerating.value"
      :active-view="activeView"
      :selected-device-type="selectedDeviceType"
      @generate-from-prd="handleGenerateFromPRD"
      @toggle-view="activeView = $event"
      @open-fullscreen="navigateToFullscreen"
      @save="handleSave"
      @update:device-type="selectedDeviceType = $event"
    />

    <!-- 生成进度指示器 -->
    <div
      v-if="prototypeState.isGenerating.value"
      class="flex-shrink-0 px-4 py-2 bg-muted/30 border-b border-border"
    >
      <div class="flex items-center gap-2">
        <Loader2 class="w-4 h-4 text-primary animate-spin" />
        <span class="text-sm text-muted-foreground">{{ stageLabel }}</span>
        <span class="text-xs text-muted-foreground/60 ml-auto">
          {{ Math.round(prototypeState.generationProgress.value.length / 1024 * 10) / 10 }} KB
        </span>
      </div>
    </div>

    <!-- 多页面导航 -->
    <PrototypePageNavigator
      v-if="effectivePages.length > 1"
      :pages="effectivePages"
      :active-page="currentActiveSlug"
      @select="handlePageSelect"
      @add-page="handleAddPage"
    />

    <!-- 内容区域 -->
    <div v-if="prototypeState.isGenerating.value" class="flex-1 overflow-hidden flex items-center justify-center bg-muted/10">
      <!-- 生成中 loading 动画 -->
      <div class="flex flex-col items-center gap-6 max-w-md text-center">
        <!-- 动态图标 -->
        <component
          :is="stageIcon"
          class="w-10 h-10 text-primary animate-spin"
        />

        <!-- 阶段文字 -->
        <div class="space-y-2">
          <p class="text-lg font-medium text-foreground transition-all duration-300">
            {{ stageLabel }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ stageDescription }}
          </p>
        </div>

        <!-- 进度条 -->
        <div class="w-64 space-y-2">
          <div class="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              :style="{ width: stageProgress + '%' }"
            />
          </div>
          <div class="flex justify-between text-xs text-muted-foreground/60">
            <span>{{ Math.round(prototypeState.generationProgress.value.length / 1024 * 10) / 10 }} KB</span>
            <span>{{ streamingPageCount > 0 ? `${streamingPageCount} 个页面` : '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="effectivePages.length > 0" class="flex-1 overflow-hidden flex flex-col">
      <!-- Preview 模式 -->
      <PrototypePreview
        v-if="activeView === 'preview'"
        :html="prototypeState.previewHtml.value"
        class="flex-1"
      />

      <!-- Code 模式 -->
      <PrototypeCodeEditor
        v-else-if="activeView === 'code'"
        :model-value="prototypeState.previewHtml.value"
        :readonly="prototypeState.isGenerating.value"
        class="flex-1"
        @update:model-value="handleCodeChange"
      />

      <!-- Split 模式 -->
      <template v-else-if="activeView === 'split'">
        <PrototypePreview
          :html="prototypeState.previewHtml.value"
          class="h-1/2"
        />
        <PrototypeCodeEditor
          :model-value="prototypeState.previewHtml.value"
          :readonly="prototypeState.isGenerating.value"
          class="h-1/2 border-t border-border"
          @update:model-value="handleCodeChange"
        />
      </template>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="!prototypeState.isGenerating.value"
      class="flex-1 flex items-center justify-center text-muted-foreground p-6"
    >
      <div class="text-center max-w-md">
        <Layout class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p class="text-sm mb-4">{{ $t('prototype.emptyHint') }}</p>
        <Button
          v-if="prdContent"
          variant="default"
          size="sm"
          class="gap-2"
          @click="handleGenerateFromPRD"
        >
          <Wand2 class="w-4 h-4" />
          {{ $t('prototype.generateFromPrd') }}
        </Button>
      </div>
    </div>

    <!-- 添加页面对话框 -->
    <Dialog v-model:open="showAddPageDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ $t('prototype.addPage') }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="pageName">{{ $t('prototype.pageName') }}</Label>
            <Input
              id="pageName"
              v-model="newPageName"
              :placeholder="$t('prototype.pageNamePlaceholder')"
            />
          </div>
          <div class="space-y-2">
            <Label for="pageSlug">{{ $t('prototype.pageSlug') }}</Label>
            <Input
              id="pageSlug"
              v-model="newPageSlug"
              :placeholder="$t('prototype.pageSlugPlaceholder')"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddPageDialog = false">{{ $t('common.cancel') }}</Button>
          <Button :disabled="!newPageName || !newPageSlug" @click="confirmAddPage">{{ $t('common.confirm') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Layout, Wand2, Loader2, Search, Palette, Code as CodeIcon, Layers, Sparkles } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '~/components/ui/dialog'
import { useToast } from '~/components/ui/toast/use-toast'
import PrototypePreview from './PrototypePreview.vue'
import PrototypeCodeEditor from './PrototypeCodeEditor.vue'
import PrototypePageNavigator from './PrototypePageNavigator.vue'
import PrototypeToolbar from './PrototypeToolbar.vue'
import { usePrototype } from '~/composables/usePrototype'
import type { DeviceType } from '~/types/prototype'

const props = defineProps<{
  prdContent: string
  prdId?: string
  availableModels: Array<{ id: string; label: string }>
  selectedModelId?: string
}>()

const emit = defineEmits<{
  'update:prdId': [prdId: string]
}>()

const { t } = useI18n()
const { toast } = useToast()
const router = useRouter()
const prototypeState = usePrototype()

const activeView = ref<'preview' | 'code' | 'split'>('preview')
const showAddPageDialog = ref(false)
const newPageName = ref('')
const newPageSlug = ref('')
const selectedDeviceType = ref<DeviceType>('responsive')

const effectivePages = computed(() => prototypeState.effectivePages.value)

const currentActiveSlug = computed(() => {
  if (prototypeState.isGenerating.value && prototypeState.streamingActiveSlug.value) {
    return prototypeState.streamingActiveSlug.value
  }
  return prototypeState.activePageSlug.value
})

// 生成阶段相关的 UI 映射
const stageIcon = computed(() => {
  const stage = prototypeState.generationStage.value
  const map = {
    idle: Loader2,
    connecting: Loader2,
    analyzing: Search,
    designing: Palette,
    coding: CodeIcon,
    assembling: Layers,
    finishing: Sparkles
  } as const
  return map[stage] || Loader2
})

const stageLabel = computed(() => {
  const stage = prototypeState.generationStage.value
  const map: Record<string, string> = {
    idle: t('prototype.generating'),
    connecting: t('prototype.stageConnecting'),
    analyzing: t('prototype.stageAnalyzing'),
    designing: t('prototype.stageDesigning'),
    coding: t('prototype.stageCoding'),
    assembling: t('prototype.stageAssembling'),
    finishing: t('prototype.stageFinishing')
  }
  return map[stage] || t('prototype.generating')
})

const stageDescription = computed(() => {
  const stage = prototypeState.generationStage.value
  const map: Record<string, string> = {
    idle: '',
    connecting: t('prototype.stageConnectingDesc'),
    analyzing: t('prototype.stageAnalyzingDesc'),
    designing: t('prototype.stageDesigningDesc'),
    coding: t('prototype.stageCodingDesc'),
    assembling: t('prototype.stageAssemblingDesc'),
    finishing: t('prototype.stageFinishingDesc')
  }
  return map[stage] || ''
})

const stageProgress = computed(() => {
  const stage = prototypeState.generationStage.value
  const map: Record<string, number> = {
    idle: 0,
    connecting: 5,
    analyzing: 15,
    designing: 30,
    coding: 60,
    assembling: 85,
    finishing: 95
  }
  return map[stage] || 0
})

const streamingPageCount = computed(() => prototypeState.streamingPages.value.length)

onMounted(() => {
  prototypeState.loadFromStorage()
})

// 当有 prdId 时，尝试加载关联的原型
watch(() => props.prdId, async (newPrdId) => {
  if (newPrdId && !prototypeState.prototype.value) {
    await prototypeState.loadByPrdId(newPrdId)
  }
}, { immediate: true })

// 生成开始时自动切换到预览模式
watch(() => prototypeState.isGenerating.value, (generating) => {
  if (generating) {
    activeView.value = 'preview'
  }
})

function handlePageSelect (slug: string) {
  if (prototypeState.isGenerating.value) {
    prototypeState.streamingActiveSlug.value = slug
  } else {
    prototypeState.activePageSlug.value = slug
  }
}

async function handleGenerateFromPRD () {
  if (!props.prdContent) {
    toast({
      title: t('prototype.noPrd'),
      variant: 'destructive'
    })
    return
  }

  const modelId = props.selectedModelId || props.availableModels[0]?.id
  if (!modelId) {
    toast({
      title: t('prototype.noModel'),
      variant: 'destructive'
    })
    return
  }

  try {
    // 如果还没有保存到数据库,先自动保存
    let prdId = props.prdId
    if (!prdId) {
      const response = await $fetch('/api/v1/conversations/save', {
        method: 'POST',
        body: {
          conversationId: Date.now().toString(),
          title: '手动编辑的PRD',
          messages: [],
          finalPrdContent: props.prdContent
        }
      })
      prdId = (response as any).id as string
      // 通知父组件更新 prdId
      emit('update:prdId', prdId)
      toast({
        title: t('prototype.autoSaved'),
        description: t('prototype.autoSavedDesc')
      })
    }

    await prototypeState.generateFromPRD(prdId!, { modelId, deviceType: selectedDeviceType.value })
    toast({ title: t('prototype.generateSuccess'), variant: 'success' })
  } catch (error) {
    toast({
      title: t('prototype.generateFailed'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  }
}

function handleCodeChange (value: string) {
  if (prototypeState.activePageSlug.value) {
    prototypeState.updatePageHtml(prototypeState.activePageSlug.value, value)
  }
}

function handleAddPage () {
  newPageName.value = ''
  newPageSlug.value = ''
  showAddPageDialog.value = true
}

function confirmAddPage () {
  if (newPageName.value && newPageSlug.value) {
    prototypeState.addPage(newPageName.value, newPageSlug.value)
    showAddPageDialog.value = false
  }
}

async function handleSave () {
  try {
    await prototypeState.saveAllToServer()
    toast({ title: t('prototype.saveSuccess'), variant: 'success' })
  } catch {
    toast({ title: t('prototype.saveFailed'), variant: 'destructive' })
  }
}

function navigateToFullscreen () {
  if (prototypeState.prototype.value?.id) {
    router.push(`/prototype/${prototypeState.prototype.value.id}`)
  }
}
</script>
