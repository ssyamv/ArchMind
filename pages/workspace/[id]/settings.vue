<template>
  <div class="min-h-screen bg-background">
    <div class="max-w-4xl mx-auto px-6 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold">{{ $t('workspace.settingsTitle') }}</h1>
        <p class="text-muted-foreground mt-1">{{ currentWorkspaceName }}</p>
      </div>

      <!-- Tabs -->
      <Tabs v-model="activeTab" class="space-y-6">
        <TabsList>
          <TabsTrigger value="general">{{ $t('workspace.settingsTabs.general') }}</TabsTrigger>
          <TabsTrigger value="members">{{ $t('workspace.settingsTabs.members') }}</TabsTrigger>
          <TabsTrigger value="webhooks">{{ $t('workspace.settingsTabs.webhooks') }}</TabsTrigger>
        </TabsList>

        <!-- 基本信息 Tab -->
        <TabsContent value="general" class="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{{ $t('workspace.settingsGeneral.title') }}</CardTitle>
              <CardDescription>{{ $t('workspace.settingsGeneral.description') }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="space-y-2">
                <Label for="ws-name">{{ $t('workspace.name') }}</Label>
                <Input id="ws-name" v-model="generalForm.name" :placeholder="$t('workspace.namePlaceholder')" />
              </div>
              <div class="space-y-2">
                <Label for="ws-desc">{{ $t('workspace.description') }}</Label>
                <Textarea
                  id="ws-desc"
                  v-model="generalForm.description"
                  :placeholder="$t('workspace.descriptionPlaceholder')"
                  rows="3"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label for="ws-icon">{{ $t('workspace.icon') }}</Label>
                  <Input id="ws-icon" v-model="generalForm.icon" placeholder="📁" maxlength="2" />
                </div>
                <div class="space-y-2">
                  <Label for="ws-color">{{ $t('workspace.color') }}</Label>
                  <Input id="ws-color" v-model="generalForm.color" type="color" />
                </div>
              </div>
              <div class="flex justify-end">
                <Button :disabled="savingGeneral" @click="handleSaveGeneral">
                  <Loader2 v-if="savingGeneral" class="w-4 h-4 mr-2 animate-spin" />
                  {{ $t('common.save') }}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- 成员管理 Tab -->
        <TabsContent value="members" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{{ $t('workspace.members.inviteTitle') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="flex gap-2">
                <Input
                  v-model="inviteEmail"
                  type="email"
                  :placeholder="$t('workspace.members.emailPlaceholder')"
                  class="flex-1"
                />
                <Select v-model="inviteRole">
                  <SelectTrigger class="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{{ $t('workspace.members.roleMember') }}</SelectItem>
                    <SelectItem value="admin">{{ $t('workspace.members.roleAdmin') }}</SelectItem>
                  </SelectContent>
                </Select>
                <Button :disabled="!inviteEmail.trim() || inviting" @click="handleInvite">
                  <Loader2 v-if="inviting" class="w-4 h-4 mr-1 animate-spin" />
                  <UserPlus v-else class="w-4 h-4 mr-1" />
                  {{ $t('workspace.members.invite') }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{{ $t('workspace.members.memberList') }}</CardTitle>
            </CardHeader>
            <CardContent>
              <div v-if="membersLoading" class="flex justify-center py-6">
                <Loader2 class="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="members.length === 0" class="text-center py-6 text-muted-foreground text-sm">
                {{ $t('workspace.members.noMembers') }}
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="member in members"
                  :key="member.id"
                  class="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                >
                  <div class="flex items-center gap-2">
                    <Avatar class="w-8 h-8">
                      <AvatarImage v-if="member.userAvatarUrl" :src="member.userAvatarUrl" />
                      <AvatarFallback class="text-xs">
                        {{ (member.userFullName || member.username || member.userEmail || '?')[0].toUpperCase() }}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p class="text-sm font-medium">{{ member.userFullName || member.username || member.userEmail }}</p>
                      <p v-if="member.userEmail" class="text-xs text-muted-foreground">{{ member.userEmail }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Badge variant="secondary" class="text-xs">
                      {{ member.role === 'owner'
                        ? $t('workspace.members.roleOwner')
                        : member.role === 'admin'
                          ? $t('workspace.members.roleAdmin')
                          : $t('workspace.members.roleMember') }}
                    </Badge>
                    <Button
                      v-if="member.role !== 'owner'"
                      variant="ghost"
                      size="sm"
                      class="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      @click="memberToRemove = member"
                    >
                      <UserMinus class="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <!-- 待接受邀请 -->
              <template v-if="pendingInvitations.length > 0">
                <Separator class="my-4" />
                <h4 class="text-sm font-medium text-muted-foreground mb-2">{{ $t('workspace.members.pendingInvitations') }}</h4>
                <div class="space-y-1">
                  <div
                    v-for="inv in pendingInvitations"
                    :key="inv.id"
                    class="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                  >
                    <span class="text-muted-foreground">{{ inv.email }}</span>
                    <div class="flex items-center gap-2">
                      <Badge variant="outline" class="text-xs">{{ $t('workspace.members.pending') }}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-6 w-6 text-muted-foreground hover:text-destructive"
                        :disabled="cancellingInvitationId === inv.id"
                        @click="handleCancelInvitation(inv)"
                      >
                        <Loader2 v-if="cancellingInvitationId === inv.id" class="w-3.5 h-3.5 animate-spin" />
                        <X v-else class="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </template>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Webhook Tab -->
        <TabsContent value="webhooks">
          <WebhookList
            :webhooks="webhooks"
            :loading="webhooksLoading"
            @create="formDialogOpen = true; editingWebhook = null"
            @edit="handleEditWebhook"
            @delete="handleDeleteWebhook"
            @view-deliveries="handleViewDeliveries"
          />
        </TabsContent>
      </Tabs>
    </div>

  <!-- Webhook 创建/编辑 Dialog -->
  <WebhookFormDialog
    ref="formDialogRef"
    :open="formDialogOpen"
    :webhook="editingWebhook"
    :submitting="webhookSubmitting"
    @update:open="formDialogOpen = $event"
    @create="handleCreateWebhook"
    @update="handleUpdateWebhook"
  />

  <!-- Webhook 删除确认 -->
  <AlertDialog :open="!!webhookToDelete" @update:open="(v) => { if (!v) webhookToDelete = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t('webhook.deleteConfirmTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t('webhook.deleteConfirmDesc', { name: webhookToDelete?.name ?? '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirmDeleteWebhook"
        >
          {{ $t('common.delete') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- 投递历史抽屉 -->
  <WebhookDeliverySheet
    :open="deliverySheetOpen"
    :webhook="selectedWebhook"
    :workspace-id="workspaceId"
    @update:open="deliverySheetOpen = $event"
  />

  <!-- 移除成员确认 -->
  <AlertDialog :open="!!memberToRemove" @update:open="(v) => { if (!v) memberToRemove = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t('workspace.members.confirmRemoveTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t('workspace.members.confirmRemoveDesc', { name: memberToRemove?.userFullName || memberToRemove?.userEmail || '' }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirmRemoveMember"
        >
          {{ $t('workspace.members.removeConfirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Loader2, UserPlus, UserMinus, X } from 'lucide-vue-next'
import { useWebhooks, type Webhook, type CreateWebhookInput, type UpdateWebhookInput } from '~/composables/useWebhooks'
import { useWorkspace, type WorkspaceMember, type WorkspaceInvitation } from '~/composables/useWorkspace'
import { useToast } from '~/components/ui/toast/use-toast'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Separator } from '~/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '~/components/ui/alert-dialog'

const route = useRoute()
const { t } = useI18n()
const { toast } = useToast()

const workspaceId = computed(() => route.params.id as string)

const activeTab = ref((route.query.tab as string) || 'general')

// ─── 工作区基本信息 ────────────────────────────────────────────────────────────
const { workspaces, updateWorkspace, fetchMembers, inviteMember, removeMember, cancelInvitation } = useWorkspace()

const currentWorkspace = computed(() => workspaces.value.find(w => w.id === workspaceId.value))
const currentWorkspaceName = computed(() => currentWorkspace.value?.name ?? '')

const savingGeneral = ref(false)
const generalForm = ref({ name: '', description: '', icon: '📁', color: '#3B82F6' })

watch(currentWorkspace, (ws) => {
  if (ws) {
    generalForm.value = {
      name: ws.name,
      description: ws.description || '',
      icon: ws.icon || '📁',
      color: ws.color || '#3B82F6'
    }
  }
}, { immediate: true })

async function handleSaveGeneral () {
  if (!generalForm.value.name.trim()) return
  savingGeneral.value = true
  try {
    await updateWorkspace(workspaceId.value, {
      name: generalForm.value.name.trim(),
      description: generalForm.value.description.trim() || undefined,
      icon: generalForm.value.icon || '📁',
      color: generalForm.value.color
    })
    toast({ title: t('workspace.editSuccess'), description: t('workspace.editSuccessDescription') })
  } catch (err: any) {
    toast({ title: t('workspace.editError'), description: err?.data?.message || err?.message, variant: 'destructive' })
  } finally {
    savingGeneral.value = false
  }
}

// ─── 成员管理 ─────────────────────────────────────────────────────────────────
const members = ref<WorkspaceMember[]>([])
const pendingInvitations = ref<WorkspaceInvitation[]>([])
const membersLoading = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<'admin' | 'member'>('member')
const inviting = ref(false)
const memberToRemove = ref<WorkspaceMember | null>(null)
const cancellingInvitationId = ref<string | null>(null)

watch(activeTab, async (tab) => {
  if (tab === 'members' && members.value.length === 0) {
    await loadMembers()
  }
})

async function loadMembers () {
  membersLoading.value = true
  try {
    const data = await fetchMembers(workspaceId.value)
    members.value = data.members
    pendingInvitations.value = data.pendingInvitations
  } catch {
    toast({ title: t('workspace.loadError'), variant: 'destructive' })
  } finally {
    membersLoading.value = false
  }
}

async function handleInvite () {
  if (!inviteEmail.value.trim()) return
  inviting.value = true
  try {
    await inviteMember(workspaceId.value, inviteEmail.value.trim(), inviteRole.value)
    toast({ title: t('workspace.members.inviteSuccess'), description: inviteEmail.value })
    inviteEmail.value = ''
    const data = await fetchMembers(workspaceId.value)
    pendingInvitations.value = data.pendingInvitations
  } catch (err: any) {
    toast({ title: t('workspace.members.inviteError'), description: err?.data?.message || err?.message, variant: 'destructive' })
  } finally {
    inviting.value = false
  }
}

async function confirmRemoveMember () {
  const member = memberToRemove.value
  memberToRemove.value = null
  if (!member) return
  try {
    await removeMember(workspaceId.value, member.userId)
    members.value = members.value.filter(m => m.id !== member.id)
    toast({ title: t('workspace.members.removeSuccess') })
  } catch (err: any) {
    toast({ title: t('workspace.members.removeError'), description: err?.data?.message || err?.message, variant: 'destructive' })
  }
}

async function handleCancelInvitation (inv: WorkspaceInvitation) {
  cancellingInvitationId.value = inv.id
  try {
    await cancelInvitation(workspaceId.value, inv.id)
    pendingInvitations.value = pendingInvitations.value.filter(i => i.id !== inv.id)
    toast({ title: t('workspace.members.cancelInviteSuccess') })
  } catch (err: any) {
    toast({ title: t('workspace.members.cancelInviteError'), description: err?.data?.message || err?.message, variant: 'destructive' })
  } finally {
    cancellingInvitationId.value = null
  }
}

// ─── Webhook 管理 ──────────────────────────────────────────────────────────────
const { webhooks, loading: webhooksLoading, submitting: webhookSubmitting, fetchWebhooks, createWebhook, updateWebhook, deleteWebhook } = useWebhooks(workspaceId.value)

const formDialogOpen = ref(false)
const formDialogRef = ref<{ showSecret: (s: string) => void } | null>(null)
const editingWebhook = ref<Webhook | null>(null)
const webhookToDelete = ref<Webhook | null>(null)
const deliverySheetOpen = ref(false)
const selectedWebhook = ref<Webhook | null>(null)

watch(activeTab, async (tab) => {
  if (tab === 'webhooks' && webhooks.value.length === 0 && !webhooksLoading.value) {
    try {
      await fetchWebhooks()
    } catch {
      toast({ title: t('webhook.deliveriesLoadError'), variant: 'destructive' })
    }
  }
})

function handleEditWebhook (wh: Webhook) {
  editingWebhook.value = wh
  formDialogOpen.value = true
}

function handleDeleteWebhook (wh: Webhook) {
  webhookToDelete.value = wh
}

function handleViewDeliveries (wh: Webhook) {
  selectedWebhook.value = wh
  deliverySheetOpen.value = true
}

async function handleCreateWebhook (input: CreateWebhookInput) {
  try {
    const { secret } = await createWebhook(input)
    formDialogRef.value?.showSecret(secret)
    toast({ title: t('webhook.createSuccess') })
  } catch (err: any) {
    toast({ title: t('webhook.createError'), description: err?.data?.message || err?.message, variant: 'destructive' })
  }
}

async function handleUpdateWebhook (webhookId: string, input: UpdateWebhookInput) {
  try {
    await updateWebhook(webhookId, input)
    formDialogOpen.value = false
    editingWebhook.value = null
    toast({ title: t('webhook.updateSuccess') })
  } catch (err: any) {
    toast({ title: t('webhook.updateError'), description: err?.data?.message || err?.message, variant: 'destructive' })
  }
}

async function confirmDeleteWebhook () {
  const wh = webhookToDelete.value
  webhookToDelete.value = null
  if (!wh) return
  try {
    await deleteWebhook(wh.id)
    toast({ title: t('webhook.deleteSuccess') })
  } catch (err: any) {
    toast({ title: t('webhook.deleteError'), description: err?.data?.message || err?.message, variant: 'destructive' })
  }
}

// ─── 初始化 ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    if (activeTab.value === 'webhooks') {
      await fetchWebhooks()
    } else if (activeTab.value === 'members') {
      await loadMembers()
    }
  } catch {
    // 各函数内部已有 toast，此处仅防止 unhandled rejection
  }
})
</script>
