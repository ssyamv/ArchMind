<template>
  <div class="max-w-[1400px] mx-auto pt-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">{{ $t('prototype.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ $t('prototype.description') }}</p>
      </div>
      <Button class="gap-2" @click="router.push('/generate')">
        <Plus class="w-4 h-4" />
        {{ $t('prototype.newPrototype') }}
      </Button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty State -->
    <div v-if="paginatedPrototypes.length === 0 && !loading" class="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Layout class="w-16 h-16 mb-4 opacity-40" />
      <p class="text-lg font-medium mb-2">{{ $t('prototype.noPrototypes') }}</p>
      <p class="text-sm mb-6">{{ $t('prototype.noPrototypesHint') }}</p>
      <Button variant="outline" @click="router.push('/generate')">
        {{ $t('prototype.goToGenerate') }}
      </Button>
    </div>

    <!-- Prototype List -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        v-for="proto in paginatedPrototypes"
        :key="proto.id"
        class="cursor-pointer hover:shadow-md transition-shadow group"
        @click="router.push(`/prototype/${proto.id}`)"
      >
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <CardTitle class="text-base truncate">{{ proto.title }}</CardTitle>
              <CardDescription v-if="proto.description" class="mt-1 line-clamp-2">
                {{ proto.description }}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  @click.stop
                >
                  <MoreHorizontal class="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click.stop="router.push(`/prototype/${proto.id}`)">
                  <Eye class="w-4 h-4 mr-2" />
                  {{ $t('prototype.openEdit') }}
                </DropdownMenuItem>
                <DropdownMenuItem class="text-destructive" @click.stop="handleDelete(proto.id)">
                  <Trash2 class="w-4 h-4 mr-2" />
                  {{ $t('common.delete') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardFooter class="pt-0 text-xs text-muted-foreground flex items-center gap-3">
          <Badge variant="secondary" class="text-xs">{{ proto.status }}</Badge>
          <span>{{ formatDate(proto.createdAt) }}</span>
        </CardFooter>
      </Card>
    </div>

    <!-- Pagination -->
    <Pagination
      v-if="totalPages > 1"
      :current-page="currentPage"
      :total-pages="totalPages"
      class="mt-6"
      @update:current-page="handlePageChange"
    />

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t('prototype.deleteConfirm') }}</DialogTitle>
          <DialogDescription>
            {{ $t('prototype.deleteConfirmDescription') }}
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Plus, Layout, Loader2, MoreHorizontal, Eye, Trash2 } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Card, CardHeader, CardTitle, CardDescription, CardFooter
} from '~/components/ui/card'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
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
import { Pagination } from '~/components/ui/pagination'
import type { Prototype } from '~/types/prototype'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

const router = useRouter()
const { toast } = useToast()
const { t, locale } = useI18n()
const { currentWorkspaceId } = useWorkspace()

const loading = ref(true)
const prototypes = ref<Prototype[]>([])
const currentPage = ref(1)
const pageSize = 6 // 每页显示 6 个原型（2x3 网格）
const deleteDialogOpen = ref(false)
const prototypeToDelete = ref<string | null>(null)

// 计算总页数
const totalPages = computed(() => Math.ceil(prototypes.value.length / pageSize))

// 当前页显示的原型
const paginatedPrototypes = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return prototypes.value.slice(start, end)
})

// 页码改变时
function handlePageChange(page: number) {
  currentPage.value = page
}

// 工作区切换时重新加载原型图
function handleWorkspaceChange () {
  currentPage.value = 1
  fetchPrototypes()
}

onMounted(async () => {
  await fetchPrototypes()

  // 监听工作区切换事件
  if (process.client) {
    window.addEventListener('workspace-changed', handleWorkspaceChange)
  }
})

// 清理事件监听器
if (process.client) {
  onBeforeUnmount(() => {
    window.removeEventListener('workspace-changed', handleWorkspaceChange)
  })
}

async function fetchPrototypes () {
  loading.value = true
  try {
    const queryParams: Record<string, string> = {}
    if (currentWorkspaceId.value) {
      queryParams.workspace_id = currentWorkspaceId.value
    }

    const response = await $fetch<{ success: boolean; data: { prototypes: Prototype[] } }>('/api/v1/prototypes', {
      query: queryParams
    })
    if (response.success) {
      prototypes.value = response.data.prototypes
    }
  } catch (error) {
    console.error('Failed to fetch prototypes:', error)
    toast({
      title: t('prototype.loadFailed'),
      variant: 'destructive'
    })
  } finally {
    loading.value = false
  }
}

function handleDelete (id: string) {
  prototypeToDelete.value = id
  deleteDialogOpen.value = true
}

async function confirmDelete () {
  if (!prototypeToDelete.value) return

  try {
    await $fetch(`/api/v1/prototypes/${prototypeToDelete.value}`, { method: 'DELETE' })
    prototypes.value = prototypes.value.filter(p => p.id !== prototypeToDelete.value)
    toast({ title: t('prototype.deleteSuccess'), variant: 'success' })
  } catch {
    toast({ title: t('prototype.deleteFailed'), variant: 'destructive' })
  } finally {
    deleteDialogOpen.value = false
    prototypeToDelete.value = null
  }
}

function formatDate (dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}
</script>
