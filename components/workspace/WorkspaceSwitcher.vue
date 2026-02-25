<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="gap-2 min-w-[200px] justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg">{{ currentWorkspace?.icon || '📁' }}</span>
          <span class="font-medium">{{ currentWorkspace?.name || t('workspace.select') }}</span>
        </div>
        <ChevronsUpDown class="w-4 h-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-[280px]">
      <DropdownMenuLabel>{{ t('workspace.switchWorkspace') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <!-- 工作区列表 -->
      <DropdownMenuRadioGroup :model-value="currentWorkspaceId">
        <DropdownMenuRadioItem
          v-for="workspace in workspaces"
          :key="workspace.id"
          :value="workspace.id"
          @click="handleSwitch(workspace.id)"
          class="gap-2 cursor-pointer"
        >
          <div class="flex items-center gap-2 flex-1">
            <span class="text-base">{{ workspace.icon }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate">{{ workspace.name }}</span>
                <Badge v-if="workspace.isDefault" variant="secondary" class="text-xs">
                  {{ t('workspace.default') }}
                </Badge>
              </div>
              <p v-if="workspace.stats" class="text-xs text-muted-foreground">
                {{ workspace.stats.prdCount }} {{ t('workspace.projects') }} ·
                {{ workspace.stats.documentCount }} {{ t('workspace.documents') }}
              </p>
            </div>
          </div>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>

      <DropdownMenuSeparator />

      <!-- 管理工作区 -->
      <DropdownMenuItem @click="showManageDialog = true" class="gap-2 cursor-pointer">
        <Settings class="w-4 h-4" />
        <span>{{ t('workspace.manage') }}</span>
      </DropdownMenuItem>

      <DropdownMenuItem @click="showCreateDialog = true" class="gap-2 cursor-pointer">
        <Plus class="w-4 h-4" />
        <span>{{ t('workspace.create') }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- 创建工作区对话框 -->
  <Dialog v-model:open="showCreateDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('workspace.createTitle') }}</DialogTitle>
        <DialogDescription>{{ t('workspace.createDescription') }}</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="name">{{ t('workspace.name') }}</Label>
          <Input
            id="name"
            v-model="newWorkspace.name"
            :placeholder="t('workspace.namePlaceholder')"
          />
        </div>

        <div class="space-y-2">
          <Label for="description">{{ t('workspace.description') }} {{ t('common.optional') }}</Label>
          <Textarea
            id="description"
            v-model="newWorkspace.description"
            :placeholder="t('workspace.descriptionPlaceholder')"
            rows="3"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="icon">{{ t('workspace.icon') }}</Label>
            <Input
              id="icon"
              v-model="newWorkspace.icon"
              placeholder="📁"
              maxlength="2"
            />
          </div>

          <div class="space-y-2">
            <Label for="color">{{ t('workspace.color') }}</Label>
            <Input
              id="color"
              v-model="newWorkspace.color"
              type="color"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showCreateDialog = false">
          {{ t('common.cancel') }}
        </Button>
        <Button @click="handleCreate" :disabled="!newWorkspace.name.trim() || creating">
          <Loader2 v-if="creating" class="w-4 h-4 mr-2 animate-spin" />
          {{ t('common.create') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 管理工作区对话框 -->
  <Dialog v-model:open="showManageDialog">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t('workspace.manageTitle') }}</DialogTitle>
        <DialogDescription>{{ t('workspace.manageDescription') }}</DialogDescription>
      </DialogHeader>

      <Tabs v-model="manageTab" class="w-full">
        <TabsList class="w-full">
          <TabsTrigger value="workspaces" class="flex-1">
            {{ t('workspace.tab.workspaces') }}
          </TabsTrigger>
          <TabsTrigger value="members" class="flex-1" @click="onMembersTabClick">
            {{ t('workspace.tab.members') }}
          </TabsTrigger>
        </TabsList>

        <!-- 工作区列表 Tab -->
        <TabsContent value="workspaces">
          <div class="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            <Card
              v-for="workspace in workspaces"
              :key="workspace.id"
              class="p-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-start gap-3 flex-1">
                  <span class="text-2xl">{{ workspace.icon }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h4 class="font-semibold">{{ workspace.name }}</h4>
                      <Badge v-if="workspace.isDefault" variant="secondary" class="text-xs">
                        {{ t('workspace.default') }}
                      </Badge>
                    </div>
                    <p v-if="workspace.description" class="text-sm text-muted-foreground mb-2">
                      {{ workspace.description }}
                    </p>
                    <p v-if="workspace.stats" class="text-xs text-muted-foreground">
                      {{ workspace.stats.prdCount }} {{ t('workspace.projects') }} ·
                      {{ workspace.stats.documentCount }} {{ t('workspace.documents') }}
                    </p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="sm">
                      <MoreVertical class="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      @click="handleEdit(workspace)"
                      class="cursor-pointer"
                    >
                      <Pencil class="w-4 h-4 mr-2" />
                      {{ t('workspace.edit') }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      @click="handleDetails(workspace)"
                      class="cursor-pointer"
                    >
                      <Info class="w-4 h-4 mr-2" />
                      {{ t('workspace.details') }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator v-if="!workspace.isDefault" />
                    <DropdownMenuItem
                      v-if="!workspace.isDefault"
                      @click="handleSetDefault(workspace.id)"
                      class="cursor-pointer"
                    >
                      <Star class="w-4 h-4 mr-2" />
                      {{ t('workspace.setAsDefault') }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="!workspace.isDefault"
                      @click="handleDelete(workspace.id)"
                      class="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 class="w-4 h-4 mr-2" />
                      {{ t('common.delete') }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          </div>
        </TabsContent>

        <!-- 成员管理 Tab -->
        <TabsContent value="members">
          <div class="py-4 space-y-4">
            <!-- 邀请新成员 -->
            <div class="space-y-2">
              <h4 class="text-sm font-medium">{{ t('workspace.members.inviteTitle') }}</h4>
              <div class="flex gap-2">
                <Input
                  v-model="inviteEmail"
                  type="email"
                  :placeholder="t('workspace.members.emailPlaceholder')"
                  class="flex-1"
                />
                <select
                  v-model="inviteRole"
                  class="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="member">{{ t('workspace.members.roleMember') }}</option>
                  <option value="admin">{{ t('workspace.members.roleAdmin') }}</option>
                </select>
                <Button
                  size="sm"
                  :disabled="!inviteEmail.trim() || inviting"
                  @click="handleInvite"
                >
                  <Loader2 v-if="inviting" class="w-4 h-4 mr-1 animate-spin" />
                  <UserPlus v-else class="w-4 h-4 mr-1" />
                  {{ t('workspace.members.invite') }}
                </Button>
              </div>
            </div>

            <Separator />

            <!-- 现有成员列表 -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium">{{ t('workspace.members.memberList') }}</h4>
                <Button variant="ghost" size="sm" @click="onMembersTabClick">
                  <RefreshCw class="w-3 h-3" />
                </Button>
              </div>
              <div v-if="membersLoading" class="text-center py-4">
                <Loader2 class="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
              </div>
              <div v-else-if="members.length === 0" class="text-center py-6 text-muted-foreground text-sm">
                {{ t('workspace.members.noMembers') }}
              </div>
              <div v-else class="space-y-2 max-h-[200px] overflow-y-auto">
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
                      <p class="text-sm font-medium leading-none">
                        {{ member.userFullName || member.username || member.userEmail }}
                      </p>
                      <p v-if="member.userEmail" class="text-xs text-muted-foreground mt-0.5">{{ member.userEmail }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Badge variant="secondary" class="text-xs">
                      {{ member.role === 'owner' ? t('workspace.members.roleOwner') : member.role === 'admin' ? t('workspace.members.roleAdmin') : t('workspace.members.roleMember') }}
                    </Badge>
                    <Button
                      v-if="member.role !== 'owner'"
                      variant="ghost"
                      size="sm"
                      class="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      @click="handleRemoveMember(member)"
                    >
                      <UserMinus class="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 待处理邀请列表 -->
            <div v-if="pendingInvitations.length > 0" class="space-y-2">
              <Separator />
              <h4 class="text-sm font-medium text-muted-foreground">{{ t('workspace.members.pendingInvitations') }}</h4>
              <div class="space-y-1">
                <div
                  v-for="inv in pendingInvitations"
                  :key="inv.id"
                  class="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                >
                  <span class="text-muted-foreground">{{ inv.email }}</span>
                  <Badge variant="outline" class="text-xs">
                    {{ t('workspace.members.pending') }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button @click="showManageDialog = false">
          {{ t('common.close') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete Confirmation Dialog -->
  <Dialog v-model:open="deleteDialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('workspace.deleteConfirm') }}</DialogTitle>
        <DialogDescription>
          {{ t('workspace.deleteConfirmDescription') }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="deleteDialogOpen = false">
          {{ t('common.cancel') }}
        </Button>
        <Button variant="destructive" @click="confirmDelete">
          {{ t('common.delete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 编辑工作区对话框 -->
  <Dialog v-model:open="showEditDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('workspace.editTitle') }}</DialogTitle>
        <DialogDescription>{{ t('workspace.editDescription') }}</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="edit-name">{{ t('workspace.name') }}</Label>
          <Input
            id="edit-name"
            v-model="editForm.name"
            :placeholder="t('workspace.namePlaceholder')"
          />
        </div>

        <div class="space-y-2">
          <Label for="edit-description">{{ t('workspace.description') }} {{ t('common.optional') }}</Label>
          <Textarea
            id="edit-description"
            v-model="editForm.description"
            :placeholder="t('workspace.descriptionPlaceholder')"
            rows="3"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="edit-icon">{{ t('workspace.icon') }}</Label>
            <Input
              id="edit-icon"
              v-model="editForm.icon"
              placeholder="📁"
              maxlength="2"
            />
          </div>

          <div class="space-y-2">
            <Label for="edit-color">{{ t('workspace.color') }}</Label>
            <Input
              id="edit-color"
              v-model="editForm.color"
              type="color"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showEditDialog = false">
          {{ t('common.cancel') }}
        </Button>
        <Button @click="handleEditSubmit" :disabled="!editForm.name.trim() || editing">
          <Loader2 v-if="editing" class="w-4 h-4 mr-2 animate-spin" />
          {{ t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 工作区详情对话框 -->
  <Dialog v-model:open="showDetailsDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('workspace.detailsTitle') }}</DialogTitle>
      </DialogHeader>

      <div v-if="detailWorkspace" class="space-y-4 py-4">
        <div class="flex items-center gap-3">
          <span class="text-3xl">{{ detailWorkspace.icon }}</span>
          <div>
            <h3 class="text-lg font-semibold">{{ detailWorkspace.name }}</h3>
            <p v-if="detailWorkspace.description" class="text-sm text-muted-foreground">
              {{ detailWorkspace.description }}
            </p>
          </div>
        </div>

        <Separator />

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <p class="text-sm text-muted-foreground">{{ t('workspace.documentCount') }}</p>
            <p class="text-2xl font-bold">{{ detailWorkspace.stats?.documentCount ?? 0 }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-sm text-muted-foreground">{{ t('workspace.prdCount') }}</p>
            <p class="text-2xl font-bold">{{ detailWorkspace.stats?.prdCount ?? 0 }}</p>
          </div>
        </div>

        <Separator />

        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">{{ t('workspace.isDefault') }}</span>
            <Badge :variant="detailWorkspace.isDefault ? 'default' : 'secondary'">
              {{ detailWorkspace.isDefault ? t('workspace.yes') : t('workspace.no') }}
            </Badge>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">{{ t('workspace.color') }}</span>
            <div class="flex items-center gap-2">
              <span
                class="inline-block w-4 h-4 rounded-full border"
                :style="{ backgroundColor: detailWorkspace.color }"
              />
              <span>{{ detailWorkspace.color }}</span>
            </div>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">{{ t('workspace.createdAt') }}</span>
            <span>{{ formatDate(detailWorkspace.createdAt) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">{{ t('workspace.updatedAt') }}</span>
            <span>{{ formatDate(detailWorkspace.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button @click="showDetailsDialog = false">
          {{ t('common.close') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ChevronsUpDown, Plus, Settings, MoreVertical, Star, Trash2, Loader2, Pencil, Info, UserPlus, UserMinus, RefreshCw } from 'lucide-vue-next'
import { useWorkspace, type Workspace, type WorkspaceMember, type WorkspaceInvitation } from '~/composables/useWorkspace'
import { useToast } from '~/components/ui/toast/use-toast'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Card } from '~/components/ui/card'
import { Separator } from '~/components/ui/separator'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog'

const { t } = useI18n()
const { toast } = useToast()

const {
  workspaces,
  currentWorkspace,
  currentWorkspaceId,
  loadWorkspaces,
  switchWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  setDefaultWorkspace,
  fetchMembers,
  inviteMember,
  removeMember
} = useWorkspace()

const showCreateDialog = ref(false)
const showManageDialog = ref(false)
const creating = ref(false)
const deleteDialogOpen = ref(false)
const workspaceToDelete = ref<string | null>(null)

const newWorkspace = ref({
  name: '',
  description: '',
  icon: '📁',
  color: '#3B82F6'
})

// 编辑工作区相关状态
const showEditDialog = ref(false)
const editing = ref(false)
const editWorkspaceId = ref<string | null>(null)
const editForm = ref({
  name: '',
  description: '',
  icon: '📁',
  color: '#3B82F6'
})

// 查看详情相关状态
const showDetailsDialog = ref(false)
const detailWorkspace = ref<Workspace | null>(null)

// 成员管理相关状态
const manageTab = ref('workspaces')
const members = ref<WorkspaceMember[]>([])
const pendingInvitations = ref<WorkspaceInvitation[]>([])
const membersLoading = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<'admin' | 'member'>('member')
const inviting = ref(false)

onMounted(async () => {
  try {
    await loadWorkspaces()
  } catch (error) {
    console.error('Failed to load workspaces:', error)
    toast({
      title: t('workspace.loadError'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  }
})

async function handleSwitch (workspaceId: string) {
  try {
    await switchWorkspace(workspaceId)
    toast({
      title: t('workspace.switchSuccess'),
      description: t('workspace.switchSuccessDescription')
    })
  } catch (error) {
    console.error('Failed to switch workspace:', error)
    toast({
      title: t('workspace.switchError'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  }
}

async function handleCreate () {
  if (!newWorkspace.value.name.trim()) return

  creating.value = true
  try {
    await createWorkspace({
      name: newWorkspace.value.name.trim(),
      description: newWorkspace.value.description.trim() || undefined,
      icon: newWorkspace.value.icon || '📁',
      color: newWorkspace.value.color || '#3B82F6'
    })

    toast({
      title: t('workspace.createSuccess'),
      description: t('workspace.createSuccessDescription')
    })

    // 重置表单
    newWorkspace.value = {
      name: '',
      description: '',
      icon: '📁',
      color: '#3B82F6'
    }

    showCreateDialog.value = false
  } catch (error) {
    console.error('Failed to create workspace:', error)
    toast({
      title: t('workspace.createError'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  } finally {
    creating.value = false
  }
}

async function handleSetDefault (workspaceId: string) {
  try {
    await setDefaultWorkspace(workspaceId)
    toast({
      title: t('workspace.setDefaultSuccess'),
      description: t('workspace.setDefaultSuccessDescription')
    })
  } catch (error) {
    console.error('Failed to set default workspace:', error)
    toast({
      title: t('workspace.setDefaultError'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  }
}

function handleDelete (workspaceId: string) {
  workspaceToDelete.value = workspaceId
  deleteDialogOpen.value = true
}

function handleEdit (workspace: Workspace) {
  editWorkspaceId.value = workspace.id
  editForm.value = {
    name: workspace.name,
    description: workspace.description || '',
    icon: workspace.icon || '📁',
    color: workspace.color || '#3B82F6'
  }
  showEditDialog.value = true
}

async function handleEditSubmit () {
  if (!editWorkspaceId.value || !editForm.value.name.trim()) return

  editing.value = true
  try {
    await updateWorkspace(editWorkspaceId.value, {
      name: editForm.value.name.trim(),
      description: editForm.value.description.trim() || undefined,
      icon: editForm.value.icon || '📁',
      color: editForm.value.color || '#3B82F6'
    })

    toast({
      title: t('workspace.editSuccess'),
      description: t('workspace.editSuccessDescription')
    })

    showEditDialog.value = false
  } catch (error) {
    console.error('Failed to update workspace:', error)
    toast({
      title: t('workspace.editError'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  } finally {
    editing.value = false
  }
}

function handleDetails (workspace: Workspace) {
  detailWorkspace.value = workspace
  showDetailsDialog.value = true
}

function formatDate (dateString: string) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function confirmDelete () {
  if (!workspaceToDelete.value) return

  try {
    await deleteWorkspace(workspaceToDelete.value)
    toast({
      title: t('workspace.deleteSuccess'),
      description: t('workspace.deleteSuccessDescription')
    })
  } catch (error) {
    console.error('Failed to delete workspace:', error)
    toast({
      title: t('workspace.deleteError'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  } finally {
    deleteDialogOpen.value = false
    workspaceToDelete.value = null
  }
}

// 成员管理函数
async function onMembersTabClick () {
  if (!currentWorkspaceId.value) return
  membersLoading.value = true
  try {
    const data = await fetchMembers(currentWorkspaceId.value)
    members.value = data.members
    pendingInvitations.value = data.pendingInvitations
  } catch (error) {
    console.error('Failed to fetch members:', error)
    toast({
      title: t('workspace.members.removeError'),
      description: error instanceof Error ? error.message : undefined,
      variant: 'destructive'
    })
  } finally {
    membersLoading.value = false
  }
}

async function handleInvite () {
  if (!inviteEmail.value.trim() || !currentWorkspaceId.value) return
  inviting.value = true
  try {
    await inviteMember(currentWorkspaceId.value, inviteEmail.value.trim(), inviteRole.value)
    toast({
      title: t('workspace.members.inviteSuccess'),
      description: inviteEmail.value
    })
    inviteEmail.value = ''
    inviteRole.value = 'member'
    // 刷新待邀请列表
    const data = await fetchMembers(currentWorkspaceId.value)
    pendingInvitations.value = data.pendingInvitations
  } catch (error: any) {
    toast({
      title: t('workspace.members.inviteError'),
      description: error?.data?.message || error?.message,
      variant: 'destructive'
    })
  } finally {
    inviting.value = false
  }
}

async function handleRemoveMember (member: WorkspaceMember) {
  if (!currentWorkspaceId.value) return
  try {
    await removeMember(currentWorkspaceId.value, member.userId)
    members.value = members.value.filter(m => m.id !== member.id)
    toast({ title: t('workspace.members.removeSuccess') })
  } catch (error: any) {
    toast({
      title: t('workspace.members.removeError'),
      description: error?.data?.message || error?.message,
      variant: 'destructive'
    })
  }
}
</script>
