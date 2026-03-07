<template>
  <div class="logic-map-page container mx-auto py-6 space-y-6">
    <!-- 头部 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" @click="handleBack">
          <ArrowLeft class="w-5 h-5" />
        </Button>
        <div>
          <h1 class="text-2xl font-bold">{{ logicMap?.title || '逻辑图' }}</h1>
          <p class="text-sm text-muted-foreground">
            {{ getTypeLabel(logicMap?.type) }} · 创建于 {{ formatDate(logicMap?.createdAt) }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="handleExportSVG" :disabled="!logicMap">
          <Download class="w-4 h-4 mr-1" />
          导出 SVG
        </Button>
        <Button variant="outline" size="sm" @click="handleReturnToPRD" :disabled="!logicMap?.prdId">
          <FileText class="w-4 h-4 mr-1" />
          返回 PRD
        </Button>
        <Button variant="ghost" size="icon" @click="toggleEditMode">
          <Edit v-if="!editMode" class="w-4 h-4" />
          <Eye v-else class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
      <p class="text-sm text-destructive">{{ error }}</p>
    </div>

    <!-- 内容区 -->
    <div v-else-if="logicMap" class="space-y-4">
      <!-- 预览模式 -->
      <Card v-if="!editMode" class="p-6">
        <LogicMapViewer ref="viewerRef" :code="logicMap.mermaidCode" />
      </Card>

      <!-- 编辑模式 -->
      <LogicMapEditor
        v-else
        :code="logicMap.mermaidCode"
        @save="handleSave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ArrowLeft, Download, FileText, Edit, Eye } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { useToast } from '~/components/ui/toast/use-toast'
import LogicMapViewer from '~/components/logic-map/LogicMapViewer.vue'
import LogicMapEditor from '~/components/logic-map/LogicMapEditor.vue'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()

const logicMap = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const editMode = ref(false)
const viewerRef = ref<InstanceType<typeof LogicMapViewer> | null>(null)

async function loadLogicMap() {
  loading.value = true
  error.value = null

  try {
    const res = await $fetch<{ success: boolean; data: any }>(`/api/v1/logic-maps/${route.params.id}`)
    if (res.success) {
      logicMap.value = res.data
    } else {
      error.value = '加载失败'
    }
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function handleSave(newCode: string) {
  try {
    const res = await $fetch<{ success: boolean; data: any }>(`/api/v1/logic-maps/${route.params.id}`, {
      method: 'PATCH',
      body: { mermaidCode: newCode },
    })
    if (res.success) {
      logicMap.value = res.data
      toast({ title: '保存成功' })
    }
  } catch (e: any) {
    toast({ title: '保存失败', description: e?.data?.message || e?.message, variant: 'destructive' })
    throw e
  }
}

function toggleEditMode() {
  editMode.value = !editMode.value
}

function handleBack() {
  router.back()
}

function handleReturnToPRD() {
  if (logicMap.value?.prdId) {
    router.push(`/prd/${logicMap.value.prdId}`)
  }
}

async function handleExportSVG() {
  if (!logicMap.value) return

  try {
    // 通过 template ref 获取 SVG 元素
    const container = viewerRef.value?.containerRef
    const svgElement = container?.querySelector('svg')
    if (!svgElement) {
      toast({ title: '导出失败', description: '未找到 SVG 元素', variant: 'destructive' })
      return
    }

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `${logicMap.value.title}.svg`
    a.click()

    URL.revokeObjectURL(url)
    toast({ title: '导出成功' })
  } catch (e: any) {
    toast({ title: '导出失败', description: e?.message, variant: 'destructive' })
  }
}

function getTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    flowchart: '流程图',
    sequence: '时序图',
    state: '状态图',
    class: '类图',
  }
  return labels[type || ''] || type
}

function formatDate(date?: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(() => {
  loadLogicMap()
})
</script>
