<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-md">
      <!-- 加载中 -->
      <div v-if="loading" class="text-center space-y-4">
        <Loader2 class="w-10 h-10 animate-spin mx-auto text-muted-foreground" />
        <p class="text-muted-foreground">{{ t('workspace.invitation.loading') }}</p>
      </div>

      <!-- 错误状态 -->
      <Card v-else-if="error" class="p-8 text-center space-y-4">
        <AlertCircle class="w-12 h-12 mx-auto text-destructive" />
        <h2 class="text-xl font-semibold">{{ t('workspace.invitation.invalidTitle') }}</h2>
        <p class="text-muted-foreground">{{ error }}</p>
        <Button @click="navigateTo('/')">{{ t('common.backHome') }}</Button>
      </Card>

      <!-- 邀请详情 -->
      <Card v-else-if="invitation" class="p-8 space-y-6">
        <div class="text-center space-y-2">
          <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Users class="w-8 h-8 text-primary" />
          </div>
          <h1 class="text-2xl font-bold">{{ t('workspace.invitation.title') }}</h1>
          <p class="text-muted-foreground">
            <strong>{{ invitation.inviterName }}</strong>
            {{ t('workspace.invitation.invitedYouTo') }}
            <strong>{{ invitation.workspaceName }}</strong>
          </p>
        </div>

        <Separator />

        <div class="space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">{{ t('workspace.invitation.workspace') }}</span>
            <span class="font-medium">{{ invitation.workspaceName }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">{{ t('workspace.invitation.role') }}</span>
            <Badge :variant="invitation.role === 'admin' ? 'default' : 'secondary'">
              {{ invitation.role === 'admin' ? t('workspace.invitation.roleAdmin') : t('workspace.invitation.roleMember') }}
            </Badge>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">{{ t('workspace.invitation.expiresAt') }}</span>
            <span class="text-muted-foreground">{{ formatDate(invitation.expiresAt) }}</span>
          </div>
        </div>

        <Separator />

        <!-- 未登录提示 -->
        <div v-if="!isAuthenticated" class="space-y-3">
          <p class="text-sm text-muted-foreground text-center">
            {{ t('workspace.invitation.loginRequired') }}
          </p>
          <div class="flex gap-2">
            <Button class="flex-1" @click="navigateTo(`/login?redirect=/invite/${token}`)">
              {{ t('auth.login') }}
            </Button>
            <Button variant="outline" class="flex-1" @click="navigateTo(`/register?redirect=/invite/${token}&email=${encodeURIComponent(invitation.email)}`)">
              {{ t('auth.register') }}
            </Button>
          </div>
        </div>

        <!-- 已登录：邮箱不匹配提示 -->
        <div v-else-if="isEmailMismatch" class="space-y-3">
          <div class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div class="flex items-center gap-2 text-destructive">
              <UserX class="w-4 h-4 shrink-0" />
              <span class="text-sm font-medium">{{ t('workspace.invitation.emailMismatchTitle') }}</span>
            </div>
            <p class="text-sm text-muted-foreground">
              {{ t('workspace.invitation.emailMismatchDesc', { current: authStore.user?.email, invited: invitation.email }) }}
            </p>
          </div>
          <Button class="w-full" @click="handleSwitchAccount">
            {{ t('workspace.invitation.switchAccount') }}
          </Button>
          <Button variant="outline" class="w-full" @click="navigateTo('/')">
            {{ t('workspace.invitation.decline') }}
          </Button>
        </div>

        <!-- 已登录：接受按钮 -->
        <div v-else class="space-y-3">
          <Button class="w-full" :disabled="accepting" @click="handleAccept">
            <Loader2 v-if="accepting" class="w-4 h-4 mr-2 animate-spin" />
            {{ t('workspace.invitation.accept') }}
          </Button>
          <Button variant="outline" class="w-full" @click="navigateTo('/')">
            {{ t('workspace.invitation.decline') }}
          </Button>
        </div>
      </Card>

      <!-- 接受成功 -->
      <Card v-else-if="accepted" class="p-8 text-center space-y-4">
        <CheckCircle2 class="w-12 h-12 mx-auto text-green-500" />
        <h2 class="text-xl font-semibold">{{ t('workspace.invitation.acceptedTitle') }}</h2>
        <p class="text-muted-foreground">{{ t('workspace.invitation.acceptedDescription', { workspace: acceptedWorkspaceName }) }}</p>
        <Button @click="navigateTo(`/app?workspaceId=${acceptedWorkspaceId}`)">{{ t('workspace.invitation.goToWorkspace') }}</Button>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Loader2, Users, AlertCircle, CheckCircle2, UserX } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'
import { Card } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { useToast } from '~/components/ui/toast/use-toast'

definePageMeta({
  layout: false
})

const { t } = useI18n()
const { toast } = useToast()
const route = useRoute()
const authStore = useAuthStore()

const token = route.params.token as string
const loading = ref(true)
const accepting = ref(false)
const error = ref<string | null>(null)
const accepted = ref(false)
const acceptedWorkspaceName = ref('')
const acceptedWorkspaceId = ref('')

const isAuthenticated = computed(() => authStore.isAuthenticated)
const isEmailMismatch = computed(() =>
  isAuthenticated.value &&
  invitation.value !== null &&
  authStore.user?.email !== invitation.value.email
)

interface InvitationDetail {
  workspaceName: string
  inviterName: string
  email: string
  role: 'admin' | 'member'
  expiresAt: string
}

const invitation = ref<InvitationDetail | null>(null)

onMounted(async () => {
  await loadInvitation()
})

async function loadInvitation () {
  loading.value = true
  error.value = null
  try {
    const response = await $fetch<{ success: boolean; data: InvitationDetail }>(
      `/api/v1/invitations/${token}`
    )
    invitation.value = response.data
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || t('workspace.invitation.invalidLink')
  } finally {
    loading.value = false
  }
}

async function handleSwitchAccount () {
  await authStore.logout()
  navigateTo(`/login?redirect=/invite/${token}`)
}

async function handleAccept () {
  accepting.value = true
  try {
    const response = await $fetch<{ success: boolean; data: { workspaceName: string; workspaceId: string }; message: string }>(
      `/api/v1/invitations/${token}/accept`,
      { method: 'POST' }
    )
    acceptedWorkspaceName.value = response.data.workspaceName
    acceptedWorkspaceId.value = response.data.workspaceId
    accepted.value = true
    invitation.value = null
    toast({
      title: t('workspace.invitation.acceptSuccess'),
      description: response.message
    })
  } catch (err: any) {
    toast({
      title: t('workspace.invitation.acceptError'),
      description: err?.data?.message || err?.message,
      variant: 'destructive'
    })
  } finally {
    accepting.value = false
  }
}

function formatDate (dateString: string) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
