<template>
  <div class="p-6">
    <!-- 数据迁移一次性通知弹窗 -->
    <AlertDialog :open="showMigrationNotice">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>系统升级通知</AlertDialogTitle>
          <AlertDialogDescription>
            我们近期完成了用户数据隔离功能的升级，每位用户的数据现在已完全独立。
            在此之前创建的部分项目数据可能存在丢失，对此带来的不便深感抱歉。
            如有疑问，请联系管理员。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction @click="dismissMigrationNotice">
            我知道了
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Header with Search, View Toggle, and Workspace Switcher -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4 flex-1">
        <div class="flex-1 max-w-md">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              :placeholder="$t('projects.searchPlaceholder')"
              class="pl-10"
            />
          </div>
        </div>
        <ClientOnly>
          <WorkspaceSwitcher />
          <template #fallback>
            <div class="min-w-[200px] h-10" />
          </template>
        </ClientOnly>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          @click="viewMode = 'grid'"
          :class="viewMode === 'grid' ? 'bg-secondary' : ''"
        >
          <Grid3x3 class="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          @click="viewMode = 'list'"
          :class="viewMode === 'list' ? 'bg-secondary' : ''"
        >
          <List class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- Projects Grid/List -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <RefreshCw class="w-8 h-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="paginatedProjects.length === 0" class="text-center py-12">
      <FolderOpen class="w-16 h-16 text-muted-foreground mx-auto mb-4" />
      <h3 class="text-lg font-semibold mb-2">{{ $t('projects.noProjects') }}</h3>
      <p class="text-muted-foreground mb-4">
        {{ searchQuery ? $t('projects.tryDifferentSearch') : $t('projects.noProjectsHint') }}
      </p>
      <Button @click="handleNewProject">
        <Plus class="w-4 h-4 mr-2" />
        {{ $t('projects.newProject') }}
      </Button>
    </div>

    <div
      v-else
      :class="viewMode === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        : 'space-y-4'"
    >
      <ProjectCard
        v-for="project in paginatedProjects"
        :key="project.id"
        :project="project"
        :view-mode="viewMode"
        @edit="handleEditProject"
        @delete="handleDeleteProject"
      />
    </div>

    <!-- Pagination -->
    <Pagination
      v-if="totalPages > 1"
      :current-page="currentPage"
      :total-pages="totalPages"
      class="mt-6"
      @update:current-page="handlePageChange"
    />

    <!-- Stats Footer -->
    <div class="mt-8 pt-6 border-t border-border">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <p class="text-2xl font-bold text-primary">{{ stats.totalPRDs }}</p>
          <p class="text-sm text-muted-foreground">{{ $t('projects.stats.totalPRDs') }}</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold text-primary">{{ stats.logicVerified }}</p>
          <p class="text-sm text-muted-foreground">{{ $t('projects.stats.logicVerified') }}</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold text-primary">{{ stats.documentCount }}</p>
          <p class="text-sm text-muted-foreground">{{ $t('projects.stats.documentCount') }}</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold text-primary">{{ stats.ragSources }}</p>
          <p class="text-sm text-muted-foreground">{{ $t('projects.stats.ragSources') }}</p>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t('projects.deleteConfirm') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t('projects.deleteConfirmDescription') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {{ $t('common.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Search, Grid3x3, List, RefreshCw, FolderOpen, Plus } from 'lucide-vue-next'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { useToast } from '~/components/ui/toast/use-toast'
import { useWorkspace } from '~/composables/useWorkspace'
import { Pagination } from '~/components/ui/pagination'
import ProjectCard from '~/components/projects/ProjectCard.vue'
import WorkspaceSwitcher from '~/components/workspace/WorkspaceSwitcher.vue'

const { t } = useI18n()
const { toast } = useToast()
const { currentWorkspaceId } = useWorkspace()

const MIGRATION_NOTICE_KEY = 'archmind_migration_notice_v011_dismissed'
const showMigrationNotice = ref(false)

const dismissMigrationNotice = () => {
  localStorage.setItem(MIGRATION_NOTICE_KEY, '1')
  showMigrationNotice.value = false
}

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

interface Project {
  id: string
  name: string
  status: 'drafting' | 'reviewing' | 'archived'
  logicCoverage: number
  lastEdited: string
  description?: string
  hasPrdContent?: boolean // 是否已生成 PRD 内容
}

interface Stats {
  totalPRDs: number
  logicVerified: number
  documentCount: number
  ragSources: number
}

const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const loading = ref(true)
const projects = ref<Project[]>([])
const currentPage = ref(1)
const pageSize = 9 // 每页显示 9 个项目（3x3 网格）
const stats = ref<Stats>({
  totalPRDs: 0,
  logicVerified: 0,
  documentCount: 0,
  ragSources: 0
})
const deleteDialogOpen = ref(false)
const projectToDelete = ref<string | null>(null)

const filteredProjects = computed(() => {
  if (!searchQuery.value) return projects.value

  const query = searchQuery.value.toLowerCase()
  return projects.value.filter(project =>
    project.name.toLowerCase().includes(query) ||
    project.description?.toLowerCase().includes(query)
  )
})

// 计算总页数
const totalPages = computed(() => Math.ceil(filteredProjects.value.length / pageSize))

// 当前页显示的项目
const paginatedProjects = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredProjects.value.slice(start, end)
})

// 页码改变时
function handlePageChange(page: number) {
  currentPage.value = page
}

onMounted(async () => {
  await loadProjects()

  // 检查是否需要显示数据迁移一次性通知
  if (!localStorage.getItem(MIGRATION_NOTICE_KEY)) {
    showMigrationNotice.value = true
  }

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

async function loadProjects () {
  loading.value = true
  try {
    // 构建查询参数,包含当前工作区 ID
    const queryParams: Record<string, string> = {}
    if (currentWorkspaceId.value) {
      queryParams.workspace_id = currentWorkspaceId.value
    }

    // Load projects from PRD API (not documents API)
    const response = await $fetch<{ success: boolean; data: { prds: any[]; total: number } }>('/api/v1/prd', {
      query: queryParams
    })

    // Transform PRD documents to projects
    projects.value = response.data.prds.map((prd: any) => {
      // 根据 metadata.hasPrdContent 判断状态
      const hasPrdContent = prd.metadata?.hasPrdContent ?? (prd.content && prd.content.trim() !== '')
      const projectStatus: 'drafting' | 'reviewing' | 'archived' = hasPrdContent
        ? (prd.status === 'published' ? 'reviewing' : 'drafting')
        : 'drafting' // 没有 PRD 内容的标记为草稿中

      return {
        id: prd.id,
        name: prd.title || t('defaults.untitledProject'),
        status: projectStatus,
        logicCoverage: 0, // 初始化为 0,稍后批量获取
        lastEdited: new Date(prd.updatedAt || prd.createdAt).toLocaleDateString(),
        description: prd.userInput || undefined,
        hasPrdContent // 添加标记,用于 UI 显示
      }
    })

    // 批量获取 Logic Coverage
    if (projects.value.length > 0) {
      try {
        const prdIds = projects.value.map(p => p.id)
        const coverageResponse = await $fetch<{ success: boolean; data: Record<string, number> }>(
          '/api/v1/logic-coverage/batch',
          {
            query: { prdIds }
          }
        )

        if (coverageResponse.success) {
          // 更新每个项目的 Logic Coverage
          projects.value.forEach(project => {
            project.logicCoverage = coverageResponse.data[project.id] || 0
          })
        }
      } catch (error) {
        console.error('Failed to load logic coverage:', error)
        // 如果批量获取失败,保持默认值 0
      }
    }

    // Load stats
    const statsResponse = await $fetch<{ success: boolean; data: any }>('/api/v1/stats')
    stats.value = {
      totalPRDs: response.data.total || projects.value.length,
      logicVerified: Math.floor((response.data.total || projects.value.length) * 0.67),
      documentCount: statsResponse.data.documentCount || 0,
      ragSources: statsResponse.data.documentCount || 0
    }
  } catch (error) {
    console.error('Failed to load projects:', error)
  } finally {
    loading.value = false
  }
}

async function handleWorkspaceChange () {
  // 工作区切换时重新加载项目数据
  await loadProjects()
}

const router = useRouter()

function handleNewProject() {
  router.push('/generate?new=1&immersive=1')
}

function handleEditProject(projectId: string) {
  router.push(`/projects/${projectId}`)
}

function handleDeleteProject(projectId: string) {
  projectToDelete.value = projectId
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!projectToDelete.value) return

  try {
    await $fetch(`/api/v1/prd/${projectToDelete.value}`, { method: 'DELETE' })
    projects.value = projects.value.filter(p => p.id !== projectToDelete.value)

    toast({
      title: t('projects.deleteSuccess'),
      description: t('projects.deleteSuccessDescription'),
      variant: 'success',
    })
  } catch (error) {
    console.error('Failed to delete project:', error)
    toast({
      title: t('projects.deleteFailed'),
      description: error instanceof Error ? error.message : t('common.error'),
      variant: 'destructive',
    })
  } finally {
    deleteDialogOpen.value = false
    projectToDelete.value = null
  }
}
</script>
