<template>
  <div class="min-h-screen bg-background">
    <Toaster />

    <!-- Navigation Header -->
    <header class="sticky top-0 z-50 glass border-b border-border/50 animate-slide-up">
      <nav class="w-full px-10 py-4">
        <div class="flex items-center justify-between">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center space-x-3 group">
            <img src="/logo.png" alt="ArchMind" class="w-8 h-8 rounded-lg object-contain" />
            <span class="text-xl font-bold gradient-text">{{ $t('app.name') }}</span>
          </NuxtLink>

          <!-- Navigation Links -->
          <div class="hidden md:flex items-center space-x-1">
            <NuxtLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-secondary/80"
              active-class="bg-secondary text-foreground"
            >
              <div class="flex items-center space-x-2">
                <component :is="link.icon" class="w-4 h-4" />
                <span>{{ link.label }}</span>
              </div>
            </NuxtLink>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-3">
            <LanguageSwitcher />
            <Button
              as-child
              size="sm"
              class="hidden md:flex glow-hover"
            >
              <NuxtLink to="/generate" class="flex items-center gap-2">
                <Sparkles class="w-4 h-4" />
                {{ $t('nav.generate') }}
              </NuxtLink>
            </Button>
            <ClientOnly>
              <Button
                variant="ghost"
                size="sm"
                @click="toggleDark"
              >
                <Moon v-if="isDark" class="w-4 h-4" />
                <Sun v-else class="w-4 h-4" />
              </Button>
            </ClientOnly>

            <!-- User Menu -->
            <ClientOnly>
              <DropdownMenu v-if="authStore.isAuthenticated && authStore.user">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="sm" class="gap-2">
                    <Avatar class="h-6 w-6">
                      <AvatarImage :src="authStore.avatarUrl" :alt="authStore.displayName" />
                      <AvatarFallback class="text-xs">
                        {{ authStore.displayName.charAt(0).toUpperCase() }}
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

              <!-- Login Button (when not authenticated) -->
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
            </ClientOnly>
          </div>
        </div>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="animate-fade-in">
      <slot />
    </main>

  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Sparkles, Moon, Sun, FolderOpen, Database, Layout, LogOut, LogIn, Settings } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
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
import { useAuthStore } from '@/stores/auth'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  await authStore.checkAuth()
})

const toggleDark = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

// 登出处理
const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

const navLinks = computed(() => [
  { to: '/app', label: t('nav.projects'), icon: FolderOpen },
  { to: '/knowledge-base', label: t('nav.knowledgeBase'), icon: Database },
  { to: '/prototypes', label: t('prototype.title'), icon: Layout }
])
</script>

