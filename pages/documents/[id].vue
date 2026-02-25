<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <Button variant="ghost" @click="router.back()">
          <ArrowLeft class="w-4 h-4 mr-2" />
          {{ $t('common.back') }}
        </Button>
        <div>
          <h1 class="text-3xl font-bold">{{ document?.title }}</h1>
          <div class="flex items-center gap-2 mt-1">
            <Badge variant="outline">{{ document?.fileType }}</Badge>
            <span class="text-muted-foreground">{{ formatSize(document?.fileSize) }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="handleDownload">
          <Download class="w-4 h-4 mr-2" />
          {{ $t('documents.details.actions.download') }}
        </Button>
        <Button variant="outline" @click="handleReindex">
          <RefreshCw class="w-4 h-4 mr-2" />
          {{ $t('documents.details.actions.reindex') }}
        </Button>
        <Button variant="destructive" @click="handleDelete">
          <Trash2 class="w-4 h-4 mr-2" />
          {{ $t('documents.details.actions.delete') }}
        </Button>
      </div>
    </div>

    <!-- Tabs -->
    <Tabs v-model="activeTab" class="w-full">
      <TabsList>
        <TabsTrigger value="content">{{ $t('documents.details.content') }}</TabsTrigger>
        <TabsTrigger value="chunks">{{ $t('documents.details.chunks') }}</TabsTrigger>
        <TabsTrigger value="usage">{{ $t('documents.details.usage') }}</TabsTrigger>
        <TabsTrigger value="versions">{{ $t('documents.details.versions') }}</TabsTrigger>
      </TabsList>

      <TabsContent value="content" class="mt-6">
        <Card>
          <CardContent class="p-6">
            <ScrollArea class="h-[600px]">
              <pre class="whitespace-pre-wrap font-mono text-sm">{{ document?.content || $t('documents.details.noContent') }}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="chunks" class="mt-6">
        <div class="space-y-4">
          <Card v-for="(chunk, index) in chunks" :key="chunk.id">
            <CardHeader>
              <CardTitle class="text-base flex items-center justify-between">
                <span>{{ $t('documents.details.chunkNumber', { number: index + 1 }) }}</span>
                <Badge variant="outline">{{ $t('documents.details.chunkIndex') }}: {{ chunk.chunkIndex }}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-sm whitespace-pre-wrap">{{ chunk.content }}</p>
            </CardContent>
          </Card>
          <p v-if="chunks.length === 0" class="text-center text-muted-foreground py-8">
            {{ $t('documents.details.noChunks') }}
          </p>
        </div>
      </TabsContent>

      <TabsContent value="usage" class="mt-6">
        <div class="space-y-4">
          <Card v-for="prd in usedInPRDs" :key="prd.id">
            <CardHeader>
              <CardTitle class="flex items-center justify-between text-base">
                <span>{{ prd.title }}</span>
                <Badge v-if="prd.relevanceScore">
                  {{ Math.round((prd.relevanceScore || 0) * 100) }}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div class="flex items-center justify-between">
                <p class="text-sm text-muted-foreground">
                  {{ formatDate(prd.createdAt) }}
                </p>
                <Button variant="outline" @click="viewPRD(prd.id)">
                  {{ $t('common.view') }}
                </Button>
              </div>
            </CardContent>
          </Card>
          <p v-if="usedInPRDs.length === 0" class="text-center text-muted-foreground py-8">
            {{ $t('documents.details.notUsed') }}
          </p>
        </div>
      </TabsContent>

      <!-- 版本历史 Tab -->
      <TabsContent value="versions" class="mt-6">
        <div class="space-y-4">
          <p v-if="versions.length === 0" class="text-center text-muted-foreground py-8">
            {{ $t('documents.details.noVersions') }}
          </p>

          <div v-else class="space-y-3">
            <!-- 版本列表 -->
            <Card v-for="ver in versions" :key="ver.id">
              <CardContent class="p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="font-medium text-sm">
                          {{ $t('documents.details.versionNumber', { version: ver.version }) }}
                        </span>
                        <Badge v-if="ver.version === document?.currentVersion" variant="default" class="text-xs">
                          {{ $t('documents.details.currentVersion') }}
                        </Badge>
                      </div>
                      <span class="text-xs text-muted-foreground mt-0.5">
                        {{ formatDate(ver.createdAt) }} · {{ formatSize(ver.fileSize) }}
                      </span>
                      <span v-if="ver.changeSummary" class="text-xs text-muted-foreground mt-0.5">
                        {{ ver.changeSummary }}
                      </span>
                    </div>
                  </div>
                  <Button
                    v-if="versions.length > 1"
                    variant="outline"
                    size="sm"
                    class="gap-1.5 text-xs"
                    @click="selectVersionForDiff(ver)"
                  >
                    <GitCompare class="w-3.5 h-3.5" />
                    {{ $t('documents.details.compareDiff') }}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <!-- Diff 对比视图 -->
            <Card v-if="diffResult" class="border-primary/30">
              <CardHeader class="pb-3">
                <CardTitle class="text-base flex items-center justify-between">
                  <span>
                    {{ $t('documents.details.diffTitle') }}:
                    {{ $t('documents.details.diffFrom', { from: diffFromVersion }) }}
                    →
                    {{ $t('documents.details.diffTo', { to: diffToVersion }) }}
                  </span>
                  <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="diffResult = null">
                    <X class="w-3.5 h-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div v-if="diffLoading" class="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  {{ $t('documents.details.diffLoading') }}
                </div>
                <ScrollArea v-else class="h-[400px]">
                  <div class="font-mono text-xs leading-relaxed">
                    <div
                      v-for="(line, idx) in diffResult"
                      :key="idx"
                      :class="[
                        'px-3 py-0.5',
                        line.type === 'added' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : '',
                        line.type === 'removed' ? 'bg-red-500/10 text-red-700 dark:text-red-400 line-through' : '',
                        line.type === 'unchanged' ? 'text-muted-foreground' : ''
                      ]"
                    >
                      <span class="select-none mr-2 text-muted-foreground/50">
                        {{ line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ' }}
                      </span>{{ line.content }}
                    </div>
                  </div>
                </ScrollArea>
                <!-- Diff 统计 -->
                <div class="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <span class="text-green-600">+{{ diffStats.added }} {{ $t('documents.details.diffAdded') }}</span>
                  <span class="text-red-600">-{{ diffStats.removed }} {{ $t('documents.details.diffRemoved') }}</span>
                  <span>{{ diffStats.unchanged }} {{ $t('documents.details.diffUnchanged') }}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t('documents.deleteDialog.title') }}</DialogTitle>
          <DialogDescription>
            {{ $t('documents.deleteDialog.description', { name: document?.title }) }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteDialogOpen = false">
            {{ $t('documents.deleteDialog.cancel') }}
          </Button>
          <Button variant="destructive" @click="confirmDelete">
            {{ $t('documents.deleteDialog.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Reindex Confirmation Dialog -->
    <Dialog v-model:open="reindexDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t('documents.reindexDialog.title') }}</DialogTitle>
          <DialogDescription>
            {{ $t('documents.reindexDialog.description') }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="reindexDialogOpen = false">
            {{ $t('documents.reindexDialog.cancel') }}
          </Button>
          <Button @click="confirmReindex">
            {{ $t('documents.reindexDialog.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowLeft, Download, RefreshCw, Trash2, GitCompare, X, Loader2 } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
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
import { useToast } from '~/components/ui/toast/use-toast'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { toast } = useToast()

const documentId = route.params.id as string
const document = ref<any>(null)
const chunks = ref<any[]>([])
const usedInPRDs = ref<any[]>([])
const versions = ref<any[]>([])
const activeTab = ref('content')
const deleteDialogOpen = ref(false)
const reindexDialogOpen = ref(false)

// 版本对比状态
interface DiffLine { type: 'added' | 'removed' | 'unchanged'; content: string }
const diffResult = ref<DiffLine[] | null>(null)
const diffLoading = ref(false)
const diffFromVersion = ref<number>(0)
const diffToVersion = ref<number>(0)
const diffStats = computed(() => {
  if (!diffResult.value) return { added: 0, removed: 0, unchanged: 0 }
  return {
    added: diffResult.value.filter(l => l.type === 'added').length,
    removed: diffResult.value.filter(l => l.type === 'removed').length,
    unchanged: diffResult.value.filter(l => l.type === 'unchanged').length
  }
})

onMounted(async () => {
  try {
    const docResponse = await $fetch<{ data: any }>(`/api/v1/documents/${documentId}`)
    document.value = docResponse.data

    const chunksResponse = await $fetch<{ data: any[] }>(`/api/v1/documents/${documentId}/chunks`)
    chunks.value = chunksResponse.data

    const usageResponse = await $fetch<{ data: any[] }>(`/api/v1/documents/${documentId}/usage`)
    usedInPRDs.value = usageResponse.data

    const versionsResponse = await $fetch<{ data: { versions: any[] } }>(`/api/v1/documents/${documentId}/versions`)
    versions.value = versionsResponse.data.versions || []
  } catch (error) {
    console.error('Failed to load document:', error)
    toast({
      title: t('documents.loadFailed'),
      variant: 'destructive',
    })
  }
})

function formatSize (bytes: number | undefined) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatDate (date: string | undefined) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN')
}

function viewPRD (prdId: string) {
  router.push(`/projects/${prdId}`)
}

async function handleDownload () {
  if (!document.value?.filePath) return

  // 下载原始文件
  const link = window.document.createElement('a')
  link.href = document.value.filePath
  link.download = document.value.title
  link.click()
}

async function handleReindex() {
  reindexDialogOpen.value = true
}

async function confirmReindex() {
  try {
    await $fetch(`/api/v1/documents/${documentId}/reindex`, { method: 'POST' })

    // 重新加载分块数据
    const chunksResponse = await $fetch<{ data: any[] }>(`/api/v1/documents/${documentId}/chunks`)
    chunks.value = chunksResponse.data

    reindexDialogOpen.value = false
    toast({
      title: t('documents.reindexSuccess'),
      variant: 'success',
    })
  } catch (error) {
    console.error('Failed to reindex:', error)
    toast({
      title: t('documents.reindexFailed'),
      variant: 'destructive',
    })
  }
}

function handleDelete() {
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  try {
    await $fetch(`/api/v1/documents/${documentId}`, { method: 'DELETE' })
    toast({
      title: t('documents.deleteSuccess'),
      variant: 'success',
    })
    router.push('/knowledge-base')
  } catch (error) {
    console.error('Failed to delete document:', error)
    toast({
      title: t('documents.deleteFailed'),
      variant: 'destructive',
    })
  }
}

/**
 * 选择某个版本与当前版本进行 diff 对比
 * 使用简单的行级 diff 算法（LCS）
 */
async function selectVersionForDiff (ver: any) {
  const currentVer = versions.value.find(v => v.version === document.value?.currentVersion)
  if (!currentVer || ver.id === currentVer.id) return

  diffLoading.value = true
  diffResult.value = []
  diffFromVersion.value = ver.version
  diffToVersion.value = currentVer.version

  try {
    const [fromRes, toRes] = await Promise.all([
      $fetch<{ data: any }>(`/api/v1/documents/${documentId}/versions/${ver.id}`),
      $fetch<{ data: any }>(`/api/v1/documents/${documentId}/versions/${currentVer.id}`)
    ])

    const fromLines = (fromRes.data?.content || '').split('\n')
    const toLines = (toRes.data?.content || '').split('\n')

    diffResult.value = computeLineDiff(fromLines, toLines)
  } catch {
    toast({ title: t('documents.details.diffLoadFailed'), variant: 'destructive' })
    diffResult.value = null
  } finally {
    diffLoading.value = false
  }
}

/**
 * 简单行级 diff：Myers 差分简化版（基于 Map 对比）
 */
function computeLineDiff (
  fromLines: string[],
  toLines: string[]
): Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> {
  const result: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> = []
  const fromSet = new Map<string, number[]>()

  fromLines.forEach((line, i) => {
    if (!fromSet.has(line)) fromSet.set(line, [])
    fromSet.get(line)!.push(i)
  })

  const usedFrom = new Set<number>()
  const matchedTo = new Map<number, number>() // toIdx → fromIdx

  toLines.forEach((line, toIdx) => {
    const candidates = fromSet.get(line)
    if (candidates) {
      const fromIdx = candidates.find(i => !usedFrom.has(i))
      if (fromIdx !== undefined) {
        usedFrom.add(fromIdx)
        matchedTo.set(toIdx, fromIdx)
      }
    }
  })

  let fromIdx = 0
  let toIdx = 0

  while (fromIdx < fromLines.length || toIdx < toLines.length) {
    if (fromIdx < fromLines.length && toIdx < toLines.length && matchedTo.get(toIdx) === fromIdx) {
      result.push({ type: 'unchanged', content: fromLines[fromIdx] })
      fromIdx++
      toIdx++
    } else if (toIdx < toLines.length && !matchedTo.has(toIdx)) {
      result.push({ type: 'added', content: toLines[toIdx] })
      toIdx++
    } else if (fromIdx < fromLines.length && !usedFrom.has(fromIdx)) {
      result.push({ type: 'removed', content: fromLines[fromIdx] })
      fromIdx++
    } else {
      if (fromIdx < fromLines.length) {
        result.push({ type: 'removed', content: fromLines[fromIdx] })
        fromIdx++
      }
      if (toIdx < toLines.length) {
        result.push({ type: 'added', content: toLines[toIdx] })
        toIdx++
      }
    }
  }

  return result
}
</script>
