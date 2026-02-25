<template>
  <div class="flex h-full">
    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Toolbar -->
      <div class="p-6 border-b border-border">
        <div class="flex items-center justify-between mb-4">
          <div class="flex-1 max-w-md">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                v-model="searchQuery"
                :placeholder="t('knowledgeBase.searchPlaceholder')"
                class="pl-10"
              />
            </div>
          </div>
          <Button @click="handleAddResource">
            <Plus class="w-4 h-4 mr-2" />
            {{ t('knowledgeBase.addResources') }}
          </Button>
        </div>

        <!-- Tabs -->
        <Tabs v-model="activeTab" class="w-full">
          <TabsList>
            <TabsTrigger value="all">{{ t('knowledgeBase.tabs.all') }}</TabsTrigger>
            <TabsTrigger value="documents">{{ t('knowledgeBase.tabs.documents') }}</TabsTrigger>
            <TabsTrigger value="prds">{{ t('knowledgeBase.tabs.prds') }}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <!-- Table -->
      <div class="flex-1 overflow-auto p-6 min-w-0">
        <!-- Loading: 骨架屏 -->
        <div v-if="loading">
          <Table class="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('knowledgeBase.table.name') }}</TableHead>
                <TableHead>{{ t('knowledgeBase.table.type') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.source') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.indexStatus') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.lastSync') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.size') }}</TableHead>
                <TableHead class="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="i in 5" :key="i">
                <TableCell><Skeleton class="h-4 w-40" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton class="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton class="h-4 w-24" /></TableCell>
                <TableCell><Skeleton class="h-4 w-12" /></TableCell>
                <TableCell><Skeleton class="h-6 w-6 rounded" /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div v-else-if="paginatedResources.length === 0" class="text-center py-12">
          <Database class="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 class="text-lg font-semibold mb-2">{{ t('knowledgeBase.noResources') }}</h3>
          <p class="text-muted-foreground">{{ t('knowledgeBase.noResourcesHint') }}</p>
        </div>

        <template v-else>
          <Table class="min-w-[640px] table-fixed">
            <colgroup>
              <col class="w-auto" />
              <col class="w-[72px]" />
              <col class="w-[96px]" />
              <col class="w-[96px]" />
              <col class="w-[100px]" />
              <col class="w-[72px]" />
              <col class="w-[50px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('knowledgeBase.table.name') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.type') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.source') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.indexStatus') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.lastSync') }}</TableHead>
                <TableHead class="whitespace-nowrap">{{ t('knowledgeBase.table.size') }}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="resource in paginatedResources"
                :key="resource.id"
                class="cursor-pointer hover:bg-secondary/50"
                :class="selectedResource?.id === resource.id ? 'bg-secondary' : ''"
                @click="selectResource(resource)"
              >
                <TableCell class="font-medium">
                  <div class="flex items-center gap-2">
                    <component :is="getResourceIcon(resource.type)" class="w-4 h-4 text-muted-foreground" />
                    {{ resource.name }}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" class="whitespace-nowrap">{{ t(`knowledgeBase.types.${resource.type}`) }}</Badge>
                </TableCell>
                <TableCell class="whitespace-nowrap">
                  <Badge :variant="resource.source === 'EXTERNAL' ? 'default' : 'secondary'" class="whitespace-nowrap">
                    {{ t(`knowledgeBase.sources.${resource.source}`) }}
                  </Badge>
                </TableCell>
                <TableCell class="whitespace-nowrap">
                  <template v-if="resource.type === 'DOCUMENT'">
                    <Badge :variant="getIndexStatusVariant(resource.processingStatus)" class="text-xs whitespace-nowrap">
                      {{ t(getIndexStatusKey(resource.processingStatus)) }}
                    </Badge>
                  </template>
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell class="text-muted-foreground whitespace-nowrap">
                  {{ formatDate(resource.lastSync) }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ formatSize(resource.size) }}
                </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child @click.stop>
                    <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                      <MoreVertical class="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click.stop="handleOpenInEditor(resource)">
                      <ExternalLink class="w-4 h-4 mr-2" />
                      {{ t('knowledgeBase.actions.openInEditor') }}
                    </DropdownMenuItem>
                    <DropdownMenuItem @click.stop="handleDownload(resource)">
                      <Download class="w-4 h-4 mr-2" />
                      {{ t('knowledgeBase.actions.download') }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click.stop="handleDeleteResource(resource)"
                    >
                      <Trash2 class="w-4 h-4 mr-2" />
                      {{ t('knowledgeBase.actions.delete') }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- Pagination -->
        <Pagination
          v-if="totalPages > 1"
          :current-page="currentPage"
          :total-pages="totalPages"
          class="mt-6"
          @update:current-page="handlePageChange"
        />
        </template>
      </div>

      <!-- Footer with Storage Stats -->
      <div class="border-t border-border p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-6 text-sm">
            <div class="flex items-center gap-2">
              <Database class="w-4 h-4 text-muted-foreground" />
              <span class="text-muted-foreground">{{ t('knowledgeBase.storage') }}:</span>
              <span class="font-medium">{{ formatSize(storageStats.used) }} / {{ formatSize(storageStats.total) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-muted-foreground" />
              <span class="text-muted-foreground">{{ t('knowledgeBase.resources') }}:</span>
              <span class="font-medium">{{ resources.length }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="handleClearCache">
              {{ t('knowledgeBase.clearCache') }}
            </Button>
            <Button variant="outline" size="sm" @click="handleReindexAll">
              <RefreshCw class="w-4 h-4 mr-2" />
              {{ t('knowledgeBase.reindexAll') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('knowledgeBase.deleteDialog.title') }}</DialogTitle>
          <DialogDescription>
            {{ t('knowledgeBase.deleteDialog.description', { name: resourceToDelete?.name }) }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteDialogOpen = false">
            {{ t('knowledgeBase.deleteDialog.cancel') }}
          </Button>
          <Button variant="destructive" @click="confirmDelete">
            {{ t('knowledgeBase.deleteDialog.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Upload Document Dialog -->
    <Dialog v-model:open="uploadDialogOpen">
      <DialogContent class="max-w-2xl" @pointer-down-outside.prevent @interact-outside.prevent>
        <DialogHeader>
          <DialogTitle>{{ t('documents.upload.title') }}</DialogTitle>
        </DialogHeader>
        <DocumentUpload :workspace-id="currentWorkspaceId ?? undefined" @uploaded="handleUploaded" />
      </DialogContent>
    </Dialog>

    <!-- Resource Inspector Sidebar -->
    <div
      v-if="selectedResource"
      class="w-80 border-l border-border flex flex-col overflow-hidden"
    >
      <div class="p-4 border-b border-border">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('knowledgeBase.inspector.title') }}
        </h3>
      </div>

      <ScrollArea class="flex-1">
        <div class="p-4 space-y-6">
          <!-- Resource Details -->
          <div>
            <h4 class="text-sm font-semibold mb-3">{{ t('knowledgeBase.inspector.details') }}</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.table.name') }}:</span>
                <span class="font-medium">{{ selectedResource.name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.table.type') }}:</span>
                <Badge variant="outline" class="ml-2">{{ t(`knowledgeBase.types.${selectedResource.type}`) }}</Badge>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.table.source') }}:</span>
                <Badge :variant="selectedResource.source === 'EXTERNAL' ? 'default' : 'secondary'" class="ml-2">
                  {{ t(`knowledgeBase.sources.${selectedResource.source}`) }}
                </Badge>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.table.size') }}:</span>
                <span class="font-medium">{{ formatSize(selectedResource.size) }}</span>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Usage Information -->
          <div>
            <h4 class="text-sm font-semibold mb-3">{{ t('knowledgeBase.inspector.usage') }}</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.inspector.referenced') }}:</span>
                <span class="font-medium">{{ selectedResource.usage?.references || 0 }} {{ t('knowledgeBase.inspector.times') }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.inspector.lastUsed') }}:</span>
                <span class="font-medium">{{ formatDate(selectedResource.usage?.lastUsed) }}</span>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Metadata -->
          <div>
            <h4 class="text-sm font-semibold mb-3">{{ t('knowledgeBase.inspector.metadata') }}</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.inspector.created') }}:</span>
                <span class="font-medium">{{ formatDate(selectedResource.createdAt) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.inspector.modified') }}:</span>
                <span class="font-medium">{{ formatDate(selectedResource.updatedAt) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">{{ t('knowledgeBase.inspector.lastSync') }}:</span>
                <span class="font-medium">{{ formatDate(selectedResource.lastSync) }}</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <!-- Inspector Actions -->
      <div class="p-4 border-t border-border space-y-2">
        <Button class="w-full" @click="handleOpenInEditor(selectedResource)">
          <ExternalLink class="w-4 h-4 mr-2" />
          {{ t('knowledgeBase.actions.openInEditor') }}
        </Button>
        <Button variant="destructive" class="w-full" @click="handleDeleteResource(selectedResource)">
          <Trash2 class="w-4 h-4 mr-2" />
          {{ t('knowledgeBase.inspector.deleteResource') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Search,
  Plus,
  RefreshCw,
  Database,
  FileText,
  MoreVertical,
  ExternalLink,
  Download,
  Trash2,
  File,
  Image as ImageIcon
} from 'lucide-vue-next'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '~/components/ui/table'
import {
  Tabs,
  TabsList,
  TabsTrigger
} from '~/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog'
import { useToast } from '~/components/ui/toast/use-toast'
import { Pagination } from '~/components/ui/pagination'
import DocumentUpload from '~/components/documents/DocumentUpload.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

const { t } = useI18n()
const { currentWorkspaceId } = useWorkspace()
const { toast } = useToast()

interface Resource {
  id: string
  name: string
  type: 'DOCUMENT' | 'PRD' | 'ASSET'
  source: 'EXTERNAL' | 'GENERATED'
  lastSync: string
  size: number
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  usage?: {
    references: number
    lastUsed: string
  }
  createdAt: string
  updatedAt: string
}

interface StorageStats {
  used: number
  total: number
}

const searchQuery = ref('')
const activeTab = ref('all')
const loading = ref(true)
const resources = ref<Resource[]>([])
const selectedResource = ref<Resource | null>(null)
const deleteDialogOpen = ref(false)
const resourceToDelete = ref<Resource | null>(null)
const uploadDialogOpen = ref(false)
const currentPage = ref(1)
const pageSize = 10 // 每页显示 10 条资源
const storageStats = ref<StorageStats>({
  used: 0,
  total: 10 * 1024 * 1024 * 1024 // 10GB
})

const filteredResources = computed(() => {
  let filtered = resources.value

  // Filter by tab
  if (activeTab.value !== 'all') {
    const typeMap = {
      documents: 'DOCUMENT',
      prds: 'PRD'
    }
    const filterType = typeMap[activeTab.value as keyof typeof typeMap]
    if (filterType) {
      filtered = filtered.filter(r => r.type === filterType)
    }
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(r => r.name.toLowerCase().includes(query))
  }

  return filtered
})

// 计算总页数
const totalPages = computed(() => Math.ceil(filteredResources.value.length / pageSize))

// 当前页显示的资源
const paginatedResources = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredResources.value.slice(start, end)
})

// 页码改变时
function handlePageChange(page: number) {
  currentPage.value = page
}

async function loadResources () {
  loading.value = true
  try {
    const queryParams: Record<string, string> = {}
    if (currentWorkspaceId.value) {
      queryParams.workspace_id = currentWorkspaceId.value
    }

    // Load both documents and PRDs in parallel
    const [documentsResponse, prdsResponse] = await Promise.all([
      $fetch<{ success: boolean; data: { documents: any[] } }>('/api/v1/documents', { query: queryParams }),
      $fetch<{ success: boolean; data: { prds: any[] } }>('/api/v1/prd', { query: queryParams })
    ])

    // Map documents
    const documents = documentsResponse.data.documents.map((doc: any) => ({
      id: doc.id,
      name: doc.title || doc.name || t('defaults.untitled'),
      type: 'DOCUMENT' as const,
      source: 'EXTERNAL' as const,
      lastSync: doc.updatedAt || doc.createdAt,
      size: doc.fileSize || doc.size || 0,
      processingStatus: doc.processingStatus,
      usage: {
        references: 0,
        lastUsed: doc.updatedAt || doc.createdAt
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }))

    // Map PRDs (只包含真正有内容的 PRD)
    const prds = prdsResponse.data.prds
      .filter((prd: any) => {
        // 只显示真正生成了 PRD 内容的记录
        const hasPrdContent = prd.metadata?.hasPrdContent ?? (prd.content && prd.content.trim() !== '')
        return hasPrdContent
      })
      .map((prd: any) => ({
        id: prd.id,
        name: prd.title || t('defaults.untitledPrd'),
        type: 'PRD' as const,
        source: 'GENERATED' as const,
        lastSync: prd.updated_at || prd.created_at,
        size: (prd.content?.length || 0) * 2, // Rough estimate: 2 bytes per char
        usage: {
          references: 0,
          lastUsed: prd.updated_at || prd.created_at
        },
        createdAt: prd.created_at,
        updatedAt: prd.updated_at
      }))

    // Combine and sort by update time
    resources.value = [...documents, ...prds].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    // Calculate storage
    storageStats.value.used = resources.value.reduce((sum, r) => sum + r.size, 0)
  } catch (error) {
    console.error('Failed to load resources:', error)
    toast({
      title: t('knowledgeBase.loadFailed'),
      variant: 'destructive'
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadResources()

  // 监听工作区切换事件
  if (process.client) {
    window.addEventListener('workspace-changed', loadResources)
  }
})

onUnmounted(() => {
  if (process.client) {
    window.removeEventListener('workspace-changed', loadResources)
  }
})

function selectResource(resource: Resource) {
  selectedResource.value = resource
}

function getResourceIcon(type: Resource['type']) {
  const icons = {
    DOCUMENT: FileText,
    PRD: File,
    ASSET: ImageIcon
  }
  return icons[type]
}

function formatDate(date: string | undefined) {
  if (!date) return t('knowledgeBase.inspector.never')
  return new Date(date).toLocaleDateString()
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function getIndexStatusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed': return 'default'
    case 'processing':
    case 'pending':
    case 'retrying': return 'secondary'
    case 'failed': return 'destructive'
    default: return 'outline'
  }
}

function getIndexStatusKey(status?: string): string {
  switch (status) {
    case 'completed': return 'documents.status.indexed'
    case 'processing': return 'documents.status.processing'
    case 'pending': return 'documents.status.pending'
    case 'retrying': return 'documents.status.retrying'
    case 'failed': return 'documents.status.failed'
    default: return 'documents.status.pending'
  }
}

const router = useRouter()

function handleAddResource() {
  uploadDialogOpen.value = true
}

async function handleUploaded(_documentId: string) {
  uploadDialogOpen.value = false
  // 重新加载资源列表
  await loadResources()
}

function handleOpenInEditor(resource: Resource) {
  // 根据资源类型路由
  if (resource.type === 'PRD') {
    router.push(`/projects/${resource.id}`)
  } else if (resource.type === 'DOCUMENT') {
    router.push(`/documents/${resource.id}`)
  } else {
    console.warn('Unsupported resource type:', resource.type)
  }
}

function handleDownload(resource: Resource) {
  if (resource.type !== 'DOCUMENT') {
    toast({ title: t('knowledgeBase.downloadNotSupported'), variant: 'destructive' })
    return
  }
  // 通过浏览器直接跳转到下载接口，后端会重定向到预签名 URL
  window.open(`/api/v1/documents/${resource.id}/download`, '_blank')
}

function handleDeleteResource(resource: Resource) {
  resourceToDelete.value = resource
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!resourceToDelete.value) return

  try {
    await $fetch(`/api/v1/documents/${resourceToDelete.value.id}`, { method: 'DELETE' })
    resources.value = resources.value.filter(r => r.id !== resourceToDelete.value!.id)
    if (selectedResource.value?.id === resourceToDelete.value.id) {
      selectedResource.value = null
    }
    deleteDialogOpen.value = false
    toast({
      title: t('knowledgeBase.deleteSuccess'),
      variant: 'success'
    })
    resourceToDelete.value = null
  } catch (error) {
    console.error('Failed to delete resource:', error)
    toast({
      title: t('knowledgeBase.deleteFailed'),
      variant: 'destructive'
    })
  }
}

function handleClearCache() {
  if (!currentWorkspaceId.value) return
  $fetch('/api/v1/documents/cache', {
    method: 'DELETE',
    query: { workspaceId: currentWorkspaceId.value }
  }).then(() => {
    toast({ title: t('knowledgeBase.clearCacheSuccess'), variant: 'success' })
    loadResources()
  }).catch((err) => {
    console.error('Clear cache failed:', err)
    toast({ title: t('knowledgeBase.clearCacheFailed'), variant: 'destructive' })
  })
}

function handleReindexAll() {
  if (!currentWorkspaceId.value) return
  $fetch('/api/v1/documents/reindex', {
    method: 'POST',
    body: { workspaceId: currentWorkspaceId.value }
  }).then(() => {
    toast({ title: t('knowledgeBase.reindexSuccess'), variant: 'success' })
  }).catch((err) => {
    console.error('Reindex failed:', err)
    toast({ title: t('knowledgeBase.reindexFailed'), variant: 'destructive' })
  })
}
</script>
