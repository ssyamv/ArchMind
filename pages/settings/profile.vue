<template>
  <div class="min-h-screen bg-background">
    <div class="max-w-4xl mx-auto px-6 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold">{{ $t('profile.title') }}</h1>
        <p class="text-muted-foreground mt-1">{{ $t('profile.subtitle') }}</p>
      </div>

      <!-- Tabs -->
      <Tabs v-model="activeTab" class="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            {{ $t('profile.tabs.profile') }}
          </TabsTrigger>
          <TabsTrigger value="security">
            {{ $t('profile.tabs.security') }}
          </TabsTrigger>
          <TabsTrigger value="models">
            {{ $t('profile.tabs.models') }}
          </TabsTrigger>
        </TabsList>

        <!-- Profile Tab -->
        <TabsContent value="profile" class="space-y-6">
          <!-- Avatar Section -->
          <Card>
            <CardHeader>
              <CardTitle>{{ $t('profile.avatar.title') }}</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="flex items-center gap-6">
                <ClientOnly>
                  <div class="relative">
                    <Avatar class="h-20 w-20">
                      <AvatarImage
                        :src="previewAvatar || authStore.avatarUrl"
                        :alt="authStore.displayName"
                        @load="avatarLoaded = true"
                        @error="avatarLoaded = true"
                      />
                      <AvatarFallback class="text-2xl bg-muted">
                        <Loader2 v-if="!avatarLoaded && authStore.avatarUrl" class="w-6 h-6 animate-spin text-muted-foreground" />
                        <span v-else>{{ authStore.displayName.charAt(0).toUpperCase() }}</span>
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </ClientOnly>
                <div class="space-y-2">
                  <Button variant="outline" @click="openCropperDialog">
                    <Upload class="w-4 h-4 mr-2" />
                    {{ $t('profile.avatar.change') }}
                  </Button>
                  <p class="text-xs text-muted-foreground">
                    {{ $t('profile.avatar.uploadHint') }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Basic Info Section -->
          <Card>
            <CardHeader>
              <CardTitle>{{ $t('profile.info.title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <!-- Username (readonly) -->
              <div class="space-y-2">
                <Label>{{ $t('profile.info.username') }}</Label>
                <Input :model-value="authStore.user?.username" disabled />
              </div>

              <!-- Email (readonly) -->
              <div class="space-y-2">
                <Label>{{ $t('profile.info.email') }}</Label>
                <Input :model-value="authStore.user?.email" disabled />
              </div>

              <!-- Full Name -->
              <div class="space-y-2">
                <Label for="fullName">{{ $t('profile.info.fullName') }}</Label>
                <Input
                  id="fullName"
                  v-model="profileForm.fullName"
                  :placeholder="$t('profile.info.fullNamePlaceholder')"
                />
              </div>

              <div class="flex justify-end">
                <Button @click="handleSaveProfile" :disabled="authStore.loading">
                  <Loader2 v-if="authStore.loading" class="w-4 h-4 mr-2 animate-spin" />
                  {{ $t('common.save') }}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Security Tab -->
        <TabsContent value="security" class="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{{ $t('profile.password.title') }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <!-- Current Password -->
              <div class="space-y-2">
                <Label for="currentPassword">{{ $t('profile.password.currentPassword') }}</Label>
                <Input
                  id="currentPassword"
                  v-model="passwordForm.currentPassword"
                  type="password"
                  :placeholder="$t('profile.password.currentPasswordPlaceholder')"
                />
              </div>

              <!-- New Password -->
              <div class="space-y-2">
                <Label for="newPassword">{{ $t('profile.password.newPassword') }}</Label>
                <Input
                  id="newPassword"
                  v-model="passwordForm.newPassword"
                  type="password"
                  :placeholder="$t('profile.password.newPasswordPlaceholder')"
                />
              </div>

              <!-- Confirm Password -->
              <div class="space-y-2">
                <Label for="confirmPassword">{{ $t('profile.password.confirmPassword') }}</Label>
                <Input
                  id="confirmPassword"
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  :placeholder="$t('profile.password.confirmPasswordPlaceholder')"
                />
              </div>

              <Alert v-if="passwordError" variant="destructive">
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>{{ passwordError }}</AlertDescription>
              </Alert>

              <div class="flex justify-end">
                <Button @click="handleChangePassword" :disabled="authStore.loading">
                  <Loader2 v-if="authStore.loading" class="w-4 h-4 mr-2 animate-spin" />
                  {{ $t('common.save') }}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Models Tab -->
        <TabsContent value="models" class="space-y-6">
          <!-- Loading State -->
          <div v-if="modelsLoading" class="flex items-center justify-center py-12">
            <Loader2 class="w-8 h-8 animate-spin text-muted-foreground" />
          </div>

          <template v-else>
            <!-- Configured Providers -->
            <Card v-if="configuredProviders.length > 0">
              <CardHeader>
                <CardTitle class="text-lg">{{ $t('profile.models.configuredTitle') }}</CardTitle>
                <CardDescription>{{ $t('profile.models.configuredDescription') }}</CardDescription>
              </CardHeader>
              <CardContent>
                <div class="space-y-4">
                  <div
                    v-for="provider in configuredProviders"
                    :key="provider.id"
                    class="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div class="flex items-center gap-4">
                      <div class="flex flex-col">
                        <span class="font-medium">{{ provider.name }}</span>
                        <span class="text-sm text-muted-foreground">{{ provider.description }}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <Switch
                        :model-value="isEnabled(provider.id)"
                        @update:model-value="handleToggle(provider.id, $event)"
                      />
                      <Button variant="ghost" size="sm" @click="openEditDialog(provider)">
                        <Settings class="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="text-destructive hover:text-destructive"
                        @click="handleDelete(provider.id)"
                      >
                        <Trash2 class="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <!-- Available Providers -->
            <Card>
              <CardHeader>
                <CardTitle class="text-lg">{{ $t('profile.models.addTitle') }}</CardTitle>
                <CardDescription>{{ $t('profile.models.addDescription') }}</CardDescription>
              </CardHeader>
              <CardContent>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    v-for="provider in unconfiguredProviders"
                    :key="provider.id"
                    class="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                    @click="openConfigDialog(provider)"
                  >
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">{{ provider.name }}</span>
                        <Badge v-if="provider.authType === 'base_url'" variant="secondary">{{ $t('profile.models.local') }}</Badge>
                      </div>
                      <p class="text-sm text-muted-foreground mt-1 line-clamp-2">{{ provider.description }}</p>
                      <div class="flex items-center gap-2 mt-2">
                        <ExternalLink class="w-3 h-3 text-muted-foreground" />
                        <span class="text-xs text-muted-foreground">{{ provider.website }}</span>
                      </div>
                    </div>
                    <Plus class="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </CardContent>
            </Card>

            <!-- Help Section -->
            <Card>
              <CardHeader>
                <CardTitle class="text-lg flex items-center gap-2">
                  <HelpCircle class="w-5 h-5" />
                  {{ $t('profile.models.helpTitle') }}
                </CardTitle>
              </CardHeader>
              <CardContent class="space-y-4 text-sm text-muted-foreground">
                <p>
                  <strong>{{ $t('profile.models.helpApiKeySecurity') }}</strong>{{ $t('profile.models.helpApiKeySecurityDesc') }}
                </p>
                <p>
                  <strong>{{ $t('profile.models.helpProxy') }}</strong>{{ $t('profile.models.helpProxyDesc') }}
                </p>
                <p>
                  <strong>{{ $t('profile.models.helpUsage') }}</strong>{{ $t('profile.models.helpUsageDesc') }}
                </p>
                <p>
                  <strong>{{ $t('profile.models.helpOllama') }}</strong>{{ $t('profile.models.helpOllamaDesc') }}
                </p>
              </CardContent>
            </Card>
          </template>
        </TabsContent>
      </Tabs>
    </div>

    <!-- Avatar Cropper Dialog -->
    <AvatarCropperDialog
      v-model:open="cropperDialogOpen"
      :loading="uploadingAvatar"
      @crop="handleCropAvatar"
      @applied="handleAvatarApplied"
    />

    <!-- Model Config Dialog -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ editingProvider?.name }}</DialogTitle>
          <DialogDescription>{{ editingProvider?.description }}</DialogDescription>
        </DialogHeader>

        <form @submit.prevent="handleSave" class="space-y-4" autocomplete="off">
          <!-- API Key Field -->
          <div v-if="needsApiKey" class="space-y-2">
            <Label for="apiKey">{{ $t('profile.models.apiKeyLabel') }}</Label>
            <div class="relative">
              <Input
                id="apiKey"
                ref="apiKeyInput"
                v-model="modelForm.apiKey"
                type="text"
                :placeholder="editingProvider?.apiKeyPlaceholder"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                data-lpignore="true"
                data-form-type="other"
                data-1p-ignore
                :style="!showApiKey ? { WebkitTextSecurity: 'disc' } : {}"
                class="pr-10"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                @click="toggleApiKeyVisibility"
              >
                <Eye v-if="!showApiKey" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t('profile.models.getApiKey') }}
              <a
                :href="editingProvider?.website"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                {{ editingProvider?.website }}
              </a>
            </p>
          </div>

          <!-- Base URL Field -->
          <div v-if="showBaseUrlField" class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="baseUrl">{{ $t('profile.models.baseUrlLabel') }}</Label>
              <Button
                v-if="!showCustomUrl && editingProvider?.supportsCustomUrl"
                type="button"
                variant="ghost"
                size="sm"
                class="h-6 text-xs"
                @click="showCustomUrl = true"
              >
                {{ $t('profile.models.useProxy') }}
              </Button>
            </div>
            <Input
              id="baseUrl"
              v-model="modelForm.baseUrl"
              :placeholder="editingProvider?.baseUrlPlaceholder || $t('profile.models.baseUrlPlaceholder')"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              data-lpignore="true"
              data-form-type="other"
              data-1p-ignore
            />
            <p class="text-xs text-muted-foreground">
              <template v-if="editingProvider?.supportsCustomUrl">
                {{ $t('profile.models.baseUrlHintProxy') }}
              </template>
              <template v-else>
                {{ $t('profile.models.baseUrlHintLocal') }}
              </template>
            </p>
          </div>

          <!-- Model Selection -->
          <div v-if="fetchedModels.length > 0" class="space-y-3">
            <div class="flex items-center justify-between">
              <Label>{{ $t('profile.models.selectModelsTitle') }}</Label>
              <span v-if="modelsFetched" class="text-xs text-green-600 dark:text-green-400">
                {{ $t('profile.models.modelsFetchedHint') }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">{{ $t('profile.models.selectModelsDesc') }}</p>

            <!-- Model checkboxes - 上限 50 个 -->
            <div class="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
              <label
                v-for="modelId in fetchedModels"
                :key="modelId"
                class="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  :checked="modelForm.selectedModels.includes(modelId)"
                  class="rounded border"
                  @change="toggleModel(modelId)"
                />
                <span class="font-mono flex-1">{{ modelId }}</span>
                <button
                  v-if="!editingProvider?.models.some(m => m.id === modelId)"
                  type="button"
                  class="text-muted-foreground hover:text-destructive p-0.5"
                  @click.prevent="removeModel(modelId)"
                >
                  <X class="w-3 h-3" />
                </button>
              </label>
            </div>

            <!-- 手动添加自定义模型 -->
            <div class="flex gap-2">
              <Input
                v-model="customModelInput"
                :placeholder="$t('profile.models.customModelPlaceholder')"
                class="flex-1 text-sm font-mono"
                @keydown.enter.prevent="addCustomModel"
              />
              <Button type="button" variant="outline" size="sm" @click="addCustomModel">
                {{ $t('profile.models.addModel') }}
              </Button>
            </div>

            <!-- 已选模型摘要 -->
            <p class="text-xs text-muted-foreground">
              <span v-if="modelForm.selectedModels.length > 0">
                {{ $t('profile.models.selectedModels') }}: {{ modelForm.selectedModels.length }} 个
              </span>
              <span v-else>{{ $t('profile.models.noModelsSelected') }}</span>
            </p>
          </div>

          <DialogFooter class="gap-2">
            <Button type="button" variant="outline" @click="dialogOpen = false">
              {{ $t('common.cancel') }}
            </Button>
            <Button
              type="button"
              variant="secondary"
              :disabled="validating !== null || !canValidate"
              @click="handleValidate"
            >
              <Loader2 v-if="validating === editingProvider?.id" class="w-4 h-4 mr-2 animate-spin" />
              {{ validating ? $t('profile.models.validating') : $t('profile.models.validateConnection') }}
            </Button>
            <Button type="submit" :disabled="validating !== null">
              <Loader2 v-if="saving" class="w-4 h-4 mr-2 animate-spin" />
              {{ $t('common.save') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  Upload,
  Loader2,
  AlertCircle,
  Settings,
  Trash2,
  Plus,
  ExternalLink,
  HelpCircle,
  Eye,
  EyeOff,
  X
} from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Switch } from '~/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog'
import { useToast } from '~/components/ui/toast/use-toast'
import { useAuthStore } from '@/stores/auth'
import { useApiConfigs } from '~/composables/useApiConfigs'
import AvatarCropperDialog from '~/components/profile/AvatarCropperDialog.vue'
import type { AIProviderConfig, AIProviderType } from '~/types/settings'

definePageMeta({
  middleware: 'auth'
})

const { t } = useI18n()
const authStore = useAuthStore()
const { toast } = useToast()
const route = useRoute()

// ---- Tab state ----
const activeTab = ref((route.query.tab as string) || 'profile')

// ---- Profile tab state ----
const previewAvatar = ref<string | null>(null)
const passwordError = ref('')
const cropperDialogOpen = ref(false)
const uploadingAvatar = ref(false)
const avatarLoaded = ref(false)

const profileForm = reactive({
  fullName: authStore.user?.fullName || ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

watch(() => authStore.user, (user) => {
  if (user) {
    profileForm.fullName = user.fullName || ''
  }
}, { immediate: true })

watch(() => authStore.avatarUrl, () => {
  avatarLoaded.value = false
})

function openCropperDialog() {
  cropperDialogOpen.value = true
}

async function handleCropAvatar(blob: Blob) {
  uploadingAvatar.value = true

  const reader = new FileReader()
  reader.onload = (e) => {
    previewAvatar.value = e.target?.result as string
  }
  reader.readAsDataURL(blob)

  const file = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' })
  const result = await authStore.uploadAvatar(file)

  uploadingAvatar.value = false

  if (result.success) {
    cropperDialogOpen.value = false
    toast({ title: t('profile.avatar.uploadSuccess'), variant: 'success' })
  } else {
    toast({ title: result.message || t('profile.avatar.uploadFailed'), variant: 'destructive' })
    previewAvatar.value = null
  }
}

function handleAvatarApplied() {
  previewAvatar.value = null
  avatarLoaded.value = false
}

async function handleSaveProfile() {
  const result = await authStore.updateProfile({ fullName: profileForm.fullName })
  if (result.success) {
    toast({ title: t('profile.info.updateSuccess'), variant: 'success' })
  } else {
    toast({ title: result.message || t('profile.info.updateFailed'), variant: 'destructive' })
  }
}

async function handleChangePassword() {
  passwordError.value = ''

  if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    passwordError.value = t('auth.passwordRequired')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    passwordError.value = t('profile.password.minLength')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = t('profile.password.mismatch')
    return
  }

  const result = await authStore.changePassword(passwordForm.currentPassword, passwordForm.newPassword)
  if (result.success) {
    toast({ title: t('profile.password.updateSuccess'), variant: 'success' })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } else {
    toast({ title: result.message || t('profile.password.updateFailed'), variant: 'destructive' })
  }
}

// ---- Models tab state ----
const {
  providers,
  configs,
  loading: modelsLoading,
  validating,
  isConfigured,
  isEnabled,
  saveConfig,
  validateConfig,
  deleteConfig,
  toggleEnabled,
  initialize
} = useApiConfigs()

const dialogOpen = ref(false)
const editingProvider = ref<AIProviderConfig | null>(null)
const showApiKey = ref(false)
const showCustomUrl = ref(false)
const saving = ref(false)
const apiKeyInput = ref<HTMLInputElement | null>(null)

// 模型选择相关状态
const fetchedModels = ref<string[]>([])  // 验证后从服务端获取的模型列表
const modelsFetched = ref(false)         // 是否动态获取了列表
const customModelInput = ref('')         // 用户手动输入的模型 ID

const modelForm = reactive({
  apiKey: '',
  baseUrl: '',
  selectedModels: [] as string[]  // 用户选中的模型 ID 列表
})

const configuredProviders = computed(() => providers.value.filter(p => isConfigured(p.id)))
const unconfiguredProviders = computed(() => providers.value.filter(p => !isConfigured(p.id)))

const needsApiKey = computed(() => {
  if (!editingProvider.value) return false
  const authType = editingProvider.value.authType
  return authType === 'api_key' || authType === 'both'
})

const needsBaseUrl = computed(() => {
  if (!editingProvider.value) return false
  const authType = editingProvider.value.authType
  return authType === 'base_url' || authType === 'both'
})

const showBaseUrlField = computed(() => {
  if (!editingProvider.value) return false
  if (editingProvider.value.authType === 'base_url') return true
  if (editingProvider.value.supportsCustomUrl && showCustomUrl.value) return true
  if (editingProvider.value.authType === 'both') return true
  return false
})

const canValidate = computed(() => {
  if (!editingProvider.value) return false
  if (needsApiKey.value && !modelForm.apiKey) return false
  if (needsBaseUrl.value && !modelForm.baseUrl) return false
  return true
})

// 切换模型选中状态
function toggleModel(modelId: string) {
  const idx = modelForm.selectedModels.indexOf(modelId)
  if (idx >= 0) {
    modelForm.selectedModels.splice(idx, 1)
  } else {
    modelForm.selectedModels.push(modelId)
  }
}

// 添加自定义模型 ID
function addCustomModel() {
  const id = customModelInput.value.trim()
  if (!id) return
  if (!modelForm.selectedModels.includes(id)) {
    modelForm.selectedModels.push(id)
    // 同时加入 fetchedModels 方便 UI 显示勾选
    if (!fetchedModels.value.includes(id)) {
      fetchedModels.value.push(id)
    }
  }
  customModelInput.value = ''
}

// 移除选中的模型
function removeModel(modelId: string) {
  const idx = modelForm.selectedModels.indexOf(modelId)
  if (idx >= 0) modelForm.selectedModels.splice(idx, 1)
  const fetchedIdx = fetchedModels.value.indexOf(modelId)
  if (fetchedIdx >= 0) fetchedModels.value.splice(fetchedIdx, 1)
}

function toggleApiKeyVisibility() {
  showApiKey.value = !showApiKey.value
}

function openConfigDialog(provider: AIProviderConfig) {
  editingProvider.value = provider
  modelForm.apiKey = ''
  modelForm.baseUrl = provider.defaultBaseUrl || ''
  modelForm.selectedModels = []
  fetchedModels.value = provider.models.map(m => m.id)
  modelsFetched.value = false
  customModelInput.value = ''
  showApiKey.value = false
  showCustomUrl.value = false
  dialogOpen.value = true
}

function openEditDialog(provider: AIProviderConfig) {
  editingProvider.value = provider
  modelForm.apiKey = ''
  const savedConfig = configs.value.find(c => c.provider === provider.id)
  modelForm.baseUrl = savedConfig?.baseUrl || provider.defaultBaseUrl || ''
  modelForm.selectedModels = savedConfig?.models ? [...savedConfig.models] : []
  // 显示已保存的模型 + 提供商预置模型的并集
  const providerModelIds = provider.models.map(m => m.id)
  const savedModelIds = savedConfig?.models || []
  fetchedModels.value = [...new Set([...providerModelIds, ...savedModelIds])]
  modelsFetched.value = false
  customModelInput.value = ''
  showApiKey.value = false
  showCustomUrl.value = !!savedConfig?.baseUrl
  dialogOpen.value = true
}

async function handleValidate() {
  if (!editingProvider.value || !canValidate.value) return

  const result = await validateConfig(
    editingProvider.value.id,
    modelForm.apiKey || undefined,
    modelForm.baseUrl || undefined
  )

  if (result.success) {
    // 更新可用模型列表
    if (result.availableModels && result.availableModels.length > 0) {
      fetchedModels.value = result.availableModels
      modelsFetched.value = result.modelsFetched ?? false
      // 如果用户尚未选择任何模型，默认全选前5个（避免选太多）
      if (modelForm.selectedModels.length === 0) {
        modelForm.selectedModels = result.availableModels.slice(0, 5)
      } else {
        // 保留用户已选的，同时过滤掉不在新列表中的（保留自定义添加的）
        const newSet = new Set(result.availableModels)
        const kept = modelForm.selectedModels.filter(id => newSet.has(id))
        const custom = modelForm.selectedModels.filter(id => !newSet.has(id))
        modelForm.selectedModels = [...kept, ...custom]
        // 自定义模型也加入展示列表
        for (const id of custom) {
          if (!fetchedModels.value.includes(id)) fetchedModels.value.push(id)
        }
      }
    }
    const hint = modelsFetched.value ? t('profile.models.modelsFetchedHint') : t('profile.models.modelsPresetHint')
    toast({ title: t('profile.models.validateSuccess'), description: `${result.message || t('profile.models.apiConnectionOk')}${hint ? ' · ' + hint : ''}`, variant: 'success' })
  } else {
    toast({ title: t('profile.models.validateFailed'), description: result.message || t('profile.models.apiConnectionFailed'), variant: 'destructive' })
  }
}

async function handleSave() {
  if (!editingProvider.value) return

  if (needsApiKey.value && !modelForm.apiKey && !isConfigured(editingProvider.value.id)) {
    toast({ title: t('profile.models.apiKeyRequired'), variant: 'destructive' })
    return
  }

  saving.value = true

  const result = await saveConfig({
    provider: editingProvider.value.id,
    apiKey: modelForm.apiKey || undefined,
    baseUrl: modelForm.baseUrl || undefined,
    models: modelForm.selectedModels.length > 0 ? modelForm.selectedModels : undefined,
    enabled: true
  })

  saving.value = false

  if (result.success) {
    toast({ title: t('profile.models.saveSuccess'), description: result.message || t('profile.models.apiConfigSaved'), variant: 'success' })
    dialogOpen.value = false
  } else {
    toast({ title: t('profile.models.saveFailed'), description: result.message || t('profile.models.saveConfigFailed'), variant: 'destructive' })
  }
}

async function handleToggle(providerId: AIProviderType, enabled: boolean) {
  const result = await toggleEnabled(providerId, enabled)
  if (result.success) {
    toast({ title: enabled ? t('profile.models.enabled') : t('profile.models.disabled'), description: result.message, variant: 'success' })
  } else {
    toast({ title: t('profile.models.operationFailed'), description: result.message, variant: 'destructive' })
  }
}

async function handleDelete(providerId: AIProviderType) {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider) return

  if (!confirm(t('profile.models.deleteConfirm', { name: provider.name }))) return

  const result = await deleteConfig(providerId)
  if (result.success) {
    toast({ title: t('profile.models.deleteSuccess'), description: result.message || t('profile.models.configDeleted'), variant: 'success' })
  } else {
    toast({ title: t('profile.models.deleteFailed'), description: result.message, variant: 'destructive' })
  }
}

onMounted(() => {
  initialize()
})
</script>
