<template>
  <div class="flex flex-col h-screen dashboard-layout animate-dashboard-enter">
    <Toaster />
    <!-- Top Header - Full Width -->
    <header class="flex h-16 shrink-0 items-center gap-4 border-b px-4 bg-background">
      <!-- 移动端：汉堡菜单按钮 -->
      <Button
        v-if="isMobile"
        variant="ghost"
        size="icon"
        class="sm:hidden shrink-0"
        data-testid="mobile-menu-toggle"
        @click="mobileMenuOpen = true"
      >
        <Menu class="w-5 h-5" />
      </Button>

      <!-- Logo -->
      <NuxtLink to="/" class="flex items-center gap-2 group">
        <img src="/logo.png" alt="ArchMind" class="size-8 rounded-lg object-contain" />
        <span class="font-semibold text-sm">ArchMind AI</span>
      </NuxtLink>

      <!-- Separator -->
      <div class="h-6 w-px bg-border" />

      <!-- Breadcrumb Navigation -->
      <Breadcrumb class="flex-1">
        <BreadcrumbList>
          <template v-for="(item, index) in breadcrumbItems" :key="index">
            <BreadcrumbSeparator v-if="index > 0" />
            <BreadcrumbItem>
              <BreadcrumbLink v-if="item.href" :href="item.href">
                {{ item.label }}
              </BreadcrumbLink>
              <BreadcrumbPage v-else>
                {{ item.label }}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </template>
        </BreadcrumbList>
      </Breadcrumb>

      <!-- Right Controls -->
      <div class="flex items-center gap-2">
        <!-- #70 全局搜索 -->
        <ClientOnly>
          <Button
            v-if="authStore.isAuthenticated"
            variant="outline"
            size="sm"
            class="hidden md:flex items-center gap-2 text-muted-foreground text-sm w-44"
            @click="searchOpen = true"
          >
            <Search class="w-3.5 h-3.5" />
            <span>搜索...</span>
            <kbd class="ml-auto text-xs bg-muted px-1 rounded">⌘K</kbd>
          </Button>
        </ClientOnly>

        <!-- #69 任务指示器 -->
        <ClientOnly>
          <TaskIndicator v-if="authStore.isAuthenticated" />
        </ClientOnly>

        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="sm"
          @click="toggleDark"
        >
          <Moon v-if="isDark" class="w-4 h-4" />
          <Sun v-else class="w-4 h-4" />
        </Button>

        <!-- User Menu / Login Button - ClientOnly to avoid hydration mismatch -->
        <ClientOnly>
          <DropdownMenu v-if="authStore.isAuthenticated && authStore.user">
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="sm" class="gap-2">
                <Avatar class="h-6 w-6">
                  <AvatarImage
                    :src="authStore.avatarUrl"
                    :alt="authStore.displayName"
                    @load="navAvatarLoaded = true"
                    @error="navAvatarLoaded = true"
                  />
                  <AvatarFallback class="text-xs bg-muted">
                    <Loader2 v-if="!navAvatarLoaded && authStore.avatarUrl" class="w-3 h-3 animate-spin text-muted-foreground" />
                    <span v-else>{{ authStore.displayName.charAt(0).toUpperCase() }}</span>
                  </AvatarFallback>
                </Avatar>
                <span class="hidden md:inline max-w-[120px] truncate">
                  {{ authStore.displayName }}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-48">
              <DropdownMenuLabel class="font-normal">
                <div class="flex flex-col space-y-1">
                  <p class="text-sm font-medium">{{ authStore.displayName }}</p>
                  <p class="text-xs text-muted-foreground">{{ authStore.user?.email }}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem as-child>
                <NuxtLink to="/settings/profile" class="cursor-pointer">
                  <Settings class="mr-2 h-4 w-4" />
                  {{ t('auth.settings') }}
                </NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="handleLogout" class="cursor-pointer">
                <LogOut class="mr-2 h-4 w-4" />
                {{ t('auth.logout') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            v-else
            variant="ghost"
            size="sm"
            as-child
          >
            <NuxtLink to="/login">
              <LogIn class="w-4 h-4 mr-1" />
              {{ t('auth.login') }}
            </NuxtLink>
          </Button>

          <template #fallback>
            <div class="w-8 h-8" />
          </template>
        </ClientOnly>
      </div>
    </header>

    <!-- Bottom Section: Sidebar + Content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left Sidebar（桌面端固定显示） -->
      <aside
        v-if="!isMobile"
        :class="[
          'border-r bg-background transition-all duration-300 flex flex-col relative',
          isSidebarCollapsed ? 'w-16' : 'w-64'
        ]"
      >
        <!-- Collapse/Expand Toggle Button -->
        <Button
          variant="ghost"
          size="icon"
          @click="toggleSidebar"
          class="absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 rounded-full border bg-background shadow-md"
        >
          <ChevronLeft v-if="!isSidebarCollapsed" class="h-4 w-4" />
          <ChevronRight v-else class="h-4 w-4" />
        </Button>

        <!-- Menu Items -->
        <nav class="flex-1 p-2 space-y-1">
          <NuxtLink
            v-for="item in menuItems"
            :key="item.to"
            :to="item.to"
            :class="[
              'flex items-center rounded-lg px-4 h-10 text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              isActive(item.to) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
            ]"
          >
            <component :is="item.icon" class="w-4 h-4 shrink-0 mr-2" />
            <Transition
              enter-active-class="transition-opacity duration-300"
              leave-active-class="transition-opacity duration-300"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <span v-show="!isSidebarCollapsed" class="whitespace-nowrap">
                {{ item.label }}
              </span>
            </Transition>
          </NuxtLink>
        </nav>

        <!-- Footer: New Project Button -->
        <div class="p-2 border-t">
          <Button
            @click="handleNewProject"
            class="w-full h-10 justify-start px-4"
          >
            <Plus class="w-4 h-4 shrink-0 mr-2" />
            <Transition
              enter-active-class="transition-opacity duration-300"
              leave-active-class="transition-opacity duration-300"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <span v-show="!isSidebarCollapsed" class="whitespace-nowrap">
                {{ t('nav.newProject') }}
              </span>
            </Transition>
          </Button>
        </div>
      </aside>

      <!-- 移动端：Sheet 抽屉侧边栏 -->
      <Sheet v-if="isMobile" v-model:open="mobileMenuOpen">
        <SheetContent side="left" class="w-64 p-0 flex flex-col">
          <!-- Sheet 内的导航菜单 -->
          <nav class="flex-1 p-2 space-y-1 mt-4">
            <NuxtLink
              v-for="item in menuItems"
              :key="item.to"
              :to="item.to"
              :class="[
                'flex items-center rounded-lg px-4 h-10 text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive(item.to) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
              ]"
              @click="mobileMenuOpen = false"
            >
              <component :is="item.icon" class="w-4 h-4 shrink-0 mr-2" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
          <!-- Sheet 内的新建项目按钮 -->
          <div class="p-2 border-t">
            <Button
              @click="handleNewProject(); mobileMenuOpen = false"
              class="w-full h-10 justify-start px-4"
            >
              <Plus class="w-4 h-4 shrink-0 mr-2" />
              <span>{{ t('nav.newProject') }}</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <!-- Main Content -->
      <main class="flex-1 overflow-auto">
        <div class="px-4 pb-4">
          <slot />
        </div>
      </main>
    </div>

    <!-- #70 全局搜索弹窗 -->
    <ClientOnly>
      <GlobalSearch v-model:open="searchOpen" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Moon, Sun, Sparkles, FolderOpen, Database, Plus, ChevronLeft, ChevronRight, Layout, LogOut, LogIn, Settings, Loader2, Search, Menu } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Sheet, SheetContent } from '~/components/ui/sheet'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '~/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Toaster } from '~/components/ui/toast'
import LanguageSwitcher from '~/components/common/LanguageSwitcher.vue'
import GlobalSearch from '~/components/search/GlobalSearch.vue'
import TaskIndicator from '~/components/tasks/TaskIndicator.vue'
import { useDocumentsStore } from '@/stores/documents'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()
const { t } = useI18n()
const isDark = computed(() => colorMode.value === 'dark')
const documentsStore = useDocumentsStore()
const authStore = useAuthStore()

const searchOpen = ref(false)

// 移动端响应式断点检测
const { isMobile } = useMobile()
const mobileMenuOpen = ref(false)

// ⌘K 快捷键唤起全局搜索
function onKeyDown (e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (authStore.isAuthenticated) searchOpen.value = true
  }
}

// 初始化时检查认证状态
onMounted(async () => {
  await authStore.checkAuth()
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
})

// Sidebar state
const isSidebarCollapsed = ref(false)
const navAvatarLoaded = ref(false)

// 当头像 URL 变化时重置加载状态
watch(() => authStore.avatarUrl, () => {
  navAvatarLoaded.value = false
})

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const toggleDark = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

// 登出处理
const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

// Menu items
const menuItems = computed(() => [
  { to: '/app', label: t('nav.projects'), icon: FolderOpen },
  { to: '/knowledge-base', label: t('nav.knowledgeBase'), icon: Database },
  { to: '/prototypes', label: t('prototype.title'), icon: Layout }
])

const isActive = (path: string) => {
  // 精确匹配
  if (route.path === path) return true

  // 特殊处理:项目详情页面应该高亮项目列表
  if (path === '/app' && route.path.startsWith('/projects/')) return true

  // 特殊处理:原型编辑页面应该高亮原型列表
  if (path === '/prototypes' && route.path.startsWith('/prototype/')) return true

  return false
}

const handleNewProject = () => {
  // 清空 localStorage 中的对话和原型数据
  if (import.meta.client) {
    localStorage.removeItem('conversation:active')
    localStorage.removeItem('prototype:active')
  }
  // 导航到生成页面(使用 query 参数标记这是新建项目)
  router.push({ path: '/generate', query: { new: '1', immersive: '1' } })
}

const breadcrumbItems = computed(() => {
  const path = route.path
  const items: Array<{ label: string; href?: string }> = []

  if (path === '/app') {
    items.push({ label: t('breadcrumb.allProjects') })
    return items
  }

  if (path === '/knowledge-base') {
    items.push({ label: t('breadcrumb.knowledgeBase') })
    return items
  }

  if (path === '/generate') {
    items.push({ label: t('breadcrumb.generate') })
    return items
  }

  if (path === '/prototypes') {
    items.push({ label: t('prototype.title') })
    return items
  }

  if (path.startsWith('/settings')) {
    items.push({ label: t('auth.settings') })
    return items
  }

  const prototypeMatch = path.match(/^\/prototype\/([^/]+)/)
  if (prototypeMatch) {
    items.push({ label: t('prototype.title'), href: '/prototypes' })
    items.push({ label: t('common.edit') })
    return items
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)/)
  if (projectMatch) {
    items.push({ label: t('breadcrumb.allProjects'), href: '/app' })
    items.push({
      label: t('breadcrumb.projectDetails')
    })
    return items
  }

  const documentMatch = path.match(/^\/documents\/([^/]+)/)
  if (documentMatch) {
    const documentId = documentMatch[1]
    const document = documentsStore.documents.find(d => d.id === documentId)
    items.push({ label: t('breadcrumb.knowledgeBase'), href: '/knowledge-base' })
    items.push({
      label: document?.title || t('breadcrumb.documentDetails')
    })
    return items
  }

  items.push({ label: t('breadcrumb.page') })
  return items
})
</script>

<style scoped>
/* Dashboard 进入动画 */
@keyframes dashboard-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-dashboard-enter {
  animation: dashboard-enter 0.4s ease-out;
}

/* 为子元素添加交错动画 */
.dashboard-layout :deep(> *) {
  animation: stagger-fade-in 0.4s ease-out backwards;
}

.dashboard-layout :deep(> *:nth-child(1)) {
  animation-delay: 0.05s;
}

.dashboard-layout :deep(> *:nth-child(2)) {
  animation-delay: 0.1s;
}

.dashboard-layout :deep(> *:nth-child(3)) {
  animation-delay: 0.15s;
}

@keyframes stagger-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
