<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- 工具栏 -->
    <div class="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between bg-muted/20">
      <div class="flex items-center gap-2">
        <Button
          v-if="prdContent"
          variant="outline"
          size="sm"
          class="gap-1.5"
          :disabled="logicMapState.isGenerating.value"
          @click="handleGenerate"
        >
          <Loader2 v-if="logicMapState.isGenerating.value" class="w-3.5 h-3.5 animate-spin" />
          <Wand2 v-else class="w-3.5 h-3.5" />
          {{ logicMapState.isGenerating.value ? $t('logicMap.generating') : (hasData ? $t('logicMap.regenerate') : $t('logicMap.generateFromPrd')) }}
        </Button>

        <template v-if="hasData">
          <Separator orientation="vertical" class="h-5" />
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            <span class="flex items-center gap-1.5">
              <div class="w-2 h-2 rounded-full bg-blue-500" />
              {{ $t('logicMap.legend.feature') }}
            </span>
            <span class="flex items-center gap-1.5">
              <div class="w-2 h-2 rounded-full bg-green-500" />
              {{ $t('logicMap.legend.role') }}
            </span>
            <span class="flex items-center gap-1.5">
              <div class="w-2 h-2 rounded-full bg-purple-500" />
              {{ $t('logicMap.legend.entity') }}
            </span>
          </div>
        </template>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="hasData"
          variant="ghost"
          size="sm"
          class="gap-1.5"
          @click="openFullscreen"
        >
          <Fullscreen class="w-3.5 h-3.5" />
          {{ $t('logicMap.fullscreen') }}
        </Button>
      </div>
    </div>

    <!-- 图谱概述 -->
    <div
      v-if="hasData && logicMapState.logicMapData.value?.summary"
      class="flex-shrink-0 px-4 py-2 bg-muted/30 border-b border-border"
    >
      <p class="text-xs text-muted-foreground">
        {{ logicMapState.logicMapData.value.summary }}
      </p>
    </div>

    <!-- 生成中 Loading -->
    <div
      v-if="logicMapState.isGenerating.value"
      class="flex-1 overflow-hidden flex items-center justify-center bg-muted/10"
    >
      <div class="flex flex-col items-center gap-6 max-w-md text-center">
        <component
          :is="stageIcon"
          class="w-10 h-10 text-primary animate-spin"
        />

        <div class="space-y-2">
          <p class="text-lg font-medium text-foreground">
            {{ stageLabel }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ stageDescription }}
          </p>
        </div>

        <div class="w-64 space-y-2">
          <div class="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              :style="{ width: stageProgress + '%' }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Vue Flow 图谱 -->
    <div v-else-if="hasData" class="flex-1 overflow-hidden">
      <ClientOnly>
        <VueFlow
          id="logic-map-main"
          :nodes="flowNodes"
          :edges="flowEdges"
          :default-viewport="{ zoom: 0.8 }"
          fit-view-on-init
        >
          <template #node-feature="featureProps">
            <FeatureNode v-bind="featureProps" />
          </template>
          <template #node-role="roleProps">
            <RoleNode v-bind="roleProps" />
          </template>
          <template #node-entity="entityProps">
            <EntityNode v-bind="entityProps" />
          </template>

          <Background :gap="16" :size="1" pattern-color="rgba(0,0,0,0.05)" />
          <Controls />
          <MiniMap
            :node-color="miniMapNodeColor"
            :pannable="true"
            :zoomable="true"
          />
        </VueFlow>
      </ClientOnly>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="flex-1 flex items-center justify-center text-muted-foreground p-6"
    >
      <div class="text-center max-w-md">
        <Network class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p class="text-sm mb-4">{{ $t('logicMap.emptyHint') }}</p>
        <Button
          v-if="prdContent"
          variant="default"
          size="sm"
          class="gap-2"
          @click="handleGenerate"
        >
          <Wand2 class="w-4 h-4" />
          {{ $t('logicMap.generateFromPrd') }}
        </Button>
        <p v-else class="text-xs text-muted-foreground/60 mt-2">{{ $t('logicMap.noPrd') }}</p>
      </div>
    </div>

    <!-- 全屏图谱 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isFullscreen"
          class="fixed inset-0 z-50 bg-background flex flex-col"
        >
          <!-- 全屏工具栏 -->
          <div class="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between bg-muted/20">
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium">{{ $t('logicMap.title') }}</span>
              <Separator orientation="vertical" class="h-5" />
              <div class="flex items-center gap-3 text-xs text-muted-foreground">
                <span class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full bg-blue-500" />
                  {{ $t('logicMap.legend.feature') }}
                </span>
                <span class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full bg-green-500" />
                  {{ $t('logicMap.legend.role') }}
                </span>
                <span class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full bg-purple-500" />
                  {{ $t('logicMap.legend.entity') }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                class="gap-1.5"
                @click="handleFullscreenFitView"
              >
                <Maximize2 class="w-3.5 h-3.5" />
                {{ $t('logicMap.fitView') }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="gap-1.5"
                @click="closeFullscreen"
              >
                <Minimize2 class="w-3.5 h-3.5" />
                {{ $t('logicMap.exitFullscreen') }}
              </Button>
            </div>
          </div>

          <!-- 全屏图谱概述 -->
          <div
            v-if="logicMapState.logicMapData.value?.summary"
            class="flex-shrink-0 px-4 py-2 bg-muted/30 border-b border-border"
          >
            <p class="text-xs text-muted-foreground">
              {{ logicMapState.logicMapData.value.summary }}
            </p>
          </div>

          <!-- 全屏 Vue Flow -->
          <div class="flex-1 overflow-hidden">
            <ClientOnly>
              <VueFlow
                id="logic-map-fullscreen"
                :nodes="flowNodes"
                :edges="flowEdges"
                :default-viewport="{ zoom: 0.8 }"
                fit-view-on-init
              >
                <template #node-feature="featureProps">
                  <FeatureNode v-bind="featureProps" />
                </template>
                <template #node-role="roleProps">
                  <RoleNode v-bind="roleProps" />
                </template>
                <template #node-entity="entityProps">
                  <EntityNode v-bind="entityProps" />
                </template>

                <Background :gap="16" :size="1" pattern-color="rgba(0,0,0,0.05)" />
                <Controls />
                <MiniMap
                  :node-color="miniMapNodeColor"
                  :pannable="true"
                  :zoomable="true"
                />
              </VueFlow>
            </ClientOnly>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import dagre from 'dagre'
import { Network, Wand2, Maximize2, Minimize2, Fullscreen, Loader2, Search, Boxes, Sparkles } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { useToast } from '~/components/ui/toast/use-toast'
import { useLogicMap } from '~/composables/useLogicMap'
import FeatureNode from './nodes/FeatureNode.vue'
import RoleNode from './nodes/RoleNode.vue'
import EntityNode from './nodes/EntityNode.vue'
import type { LogicMapEdgeType } from '~/types/logic-map'
import type { Node, Edge } from '@vue-flow/core'

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
const logicMapState = useLogicMap()
const { fitView, onPaneReady } = useVueFlow('logic-map-main')
const { fitView: fitViewFullscreen } = useVueFlow('logic-map-fullscreen')

const isFullscreen = ref(false)

const hasData = computed(() => {
  return logicMapState.logicMapData.value &&
    logicMapState.logicMapData.value.nodes.length > 0
})

// 生成阶段 UI 映射
const stageIcon = computed(() => {
  const stage = logicMapState.generationStage.value
  const map = {
    idle: Loader2,
    connecting: Loader2,
    analyzing: Search,
    building: Boxes,
    finishing: Sparkles
  } as const
  return map[stage] || Loader2
})

const stageLabel = computed(() => {
  const stage = logicMapState.generationStage.value
  const map: Record<string, string> = {
    idle: t('logicMap.generating'),
    connecting: t('logicMap.stageConnecting'),
    analyzing: t('logicMap.stageAnalyzing'),
    building: t('logicMap.stageBuilding'),
    finishing: t('logicMap.stageFinishing')
  }
  return map[stage] || t('logicMap.generating')
})

const stageDescription = computed(() => {
  const stage = logicMapState.generationStage.value
  const map: Record<string, string> = {
    idle: '',
    connecting: t('logicMap.stageConnectingDesc'),
    analyzing: t('logicMap.stageAnalyzingDesc'),
    building: t('logicMap.stageBuildingDesc'),
    finishing: t('logicMap.stageFinishingDesc')
  }
  return map[stage] || ''
})

const stageProgress = computed(() => {
  const stage = logicMapState.generationStage.value
  const map: Record<string, number> = {
    idle: 0,
    connecting: 10,
    analyzing: 40,
    building: 75,
    finishing: 95
  }
  return map[stage] || 0
})

// dagre 自动布局
function applyDagreLayout (rawNodes: Node[], rawEdges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: 80,
    ranksep: 100,
    marginx: 20,
    marginy: 20
  })

  for (const node of rawNodes) {
    g.setNode(node.id, { width: 180, height: 80 })
  }

  for (const edge of rawEdges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return rawNodes.map(node => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: { x: pos.x - 90, y: pos.y - 40 }
    }
  })
}

// 边样式映射
function getEdgeStyle (type: LogicMapEdgeType) {
  const styles: Record<string, { stroke: string; strokeDasharray?: string }> = {
    dependency: { stroke: '#3b82f6' },
    interaction: { stroke: '#22c55e' },
    dataflow: { stroke: '#a855f7', strokeDasharray: '5 5' }
  }
  return styles[type] || { stroke: '#94a3b8' }
}

// 数据转换：LogicMapData → Vue Flow nodes/edges
const flowNodes = computed<Node[]>(() => {
  if (!logicMapState.logicMapData.value) return []

  const rawNodes: Node[] = logicMapState.logicMapData.value.nodes.map(n => ({
    id: n.id,
    type: n.type,
    position: { x: 0, y: 0 },
    data: { label: n.label, description: n.description }
  }))

  const rawEdges: Edge[] = logicMapState.logicMapData.value.edges.map(e => ({
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target
  }))

  return applyDagreLayout(rawNodes, rawEdges)
})

const flowEdges = computed<Edge[]>(() => {
  if (!logicMapState.logicMapData.value) return []

  return logicMapState.logicMapData.value.edges.map(e => ({
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
    animated: e.type === 'dataflow',
    style: getEdgeStyle(e.type),
    labelStyle: { fontSize: '11px', fill: '#6b7280' }
  }))
})

// MiniMap 节点颜色
function miniMapNodeColor (node: Node) {
  const colors: Record<string, string> = {
    feature: '#3b82f6',
    role: '#22c55e',
    entity: '#a855f7'
  }
  return colors[node.type || ''] || '#94a3b8'
}

// Ensure fitView is called only after viewport is initialized
onPaneReady(() => {
  fitView()
})

function openFullscreen () {
  isFullscreen.value = true
  // fit-view-on-init on the fullscreen VueFlow handles initial fitting
}

function closeFullscreen () {
  isFullscreen.value = false
}

function handleFullscreenFitView () {
  fitViewFullscreen()
}

async function handleGenerate () {
  if (!props.prdContent) {
    toast({
      title: t('logicMap.noPrd'),
      variant: 'destructive'
    })
    return
  }

  const modelId = props.selectedModelId || props.availableModels[0]?.id
  if (!modelId) {
    toast({
      title: t('logicMap.noModel'),
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
          title: t('logicMap.manuallyEditedPrd'),
          messages: [],
          finalPrdContent: props.prdContent
        }
      })
      prdId = (response as any).id as string
      // 通知父组件更新 prdId
      emit('update:prdId', prdId)
      toast({
        title: t('logicMap.autoSaved'),
        description: t('logicMap.autoSavedDesc')
      })
    }

    await logicMapState.generateFromPRD(prdId!, { modelId })
    toast({ title: t('logicMap.generateSuccess'), variant: 'success' })
  } catch (error) {
    toast({
      title: t('logicMap.generateFailed'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  }
}

onMounted(async () => {
  logicMapState.loadFromStorage()

  // 如果有 prdId，尝试从数据库加载逻辑图谱
  if (props.prdId) {
    // 先检查 localStorage 是否有数据，没有则从服务端加载
    if (!logicMapState.logicMapData.value?.nodes?.length) {
      await logicMapState.loadByPrdId(props.prdId)
    }
  }

  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function handleKeydown (e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) {
    closeFullscreen()
  }
}
</script>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
</style>
