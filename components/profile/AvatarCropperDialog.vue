<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-[620px]">
      <DialogHeader>
        <DialogTitle>{{ $t('profile.avatar.change') }}</DialogTitle>
        <DialogDescription>选择更换头像的方式</DialogDescription>
      </DialogHeader>

      <!-- 模式切换标签 -->
      <Tabs v-model="activeMode" class="w-full">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="upload" class="px-2">
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              <Upload class="w-3.5 h-3.5 shrink-0" />
              上传图片
            </span>
          </TabsTrigger>
          <TabsTrigger value="ai" class="px-2">
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              <Sparkles class="w-3.5 h-3.5 shrink-0" />
              AI 生成
            </span>
          </TabsTrigger>
          <TabsTrigger value="default" class="px-2">
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              <Smile class="w-3.5 h-3.5 shrink-0" />
              默认头像
            </span>
          </TabsTrigger>
        </TabsList>

        <!-- ===== 上传图片 ===== -->
        <TabsContent value="upload" class="space-y-4 mt-4">
          <!-- 上传区 -->
          <div
            v-if="!imageSrc"
            class="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            @click="triggerFileInput"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <Upload class="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p class="text-sm text-muted-foreground mb-2">拖拽或点击上传图片</p>
            <Button variant="outline" size="sm">选择文件</Button>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              class="hidden"
              @change="handleFileSelect"
            />
          </div>

          <!-- 裁剪区 -->
          <div v-else class="space-y-3">
            <div class="cropper-container">
              <Cropper
                ref="cropperRef"
                class="cropper"
                :src="imageSrc"
                :stencil-component="CircleStencil"
                :stencil-props="{ handlers: {}, movable: true, resizable: true, lines: {} }"
                :resize-image="{ touch: true, wheel: true, adjustStencil: false }"
                :transitions="true"
              />
            </div>
            <div class="flex gap-2 justify-center">
              <Button variant="outline" size="icon" class="h-8 w-8" @click="rotateLeft" title="向左旋转">
                <RotateCcw class="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" class="h-8 w-8" @click="rotateRight" title="向右旋转">
                <RotateCw class="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" class="h-8 w-8" @click="flipHorizontal" title="水平翻转">
                <FlipHorizontal class="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" class="h-8 w-8" @click="flipVertical" title="垂直翻转">
                <FlipVertical class="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" class="h-8 w-8" @click="resetImage" title="重置">
                <RefreshCw class="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" class="h-8 ml-2" @click="clearImage">
                重新选择
              </Button>
            </div>
          </div>

          <DialogFooter class="gap-2">
            <Button variant="outline" size="sm" @click="handleCancel">取消</Button>
            <Button size="sm" :disabled="!imageSrc || loading" @click="handleCrop">
              <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
              确认裁剪
            </Button>
          </DialogFooter>
        </TabsContent>

        <!-- ===== AI 生成 ===== -->
        <TabsContent value="ai" class="space-y-4 mt-4">
          <!-- 风格选择 -->
          <div class="space-y-2">
            <Label>头像风格</Label>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="style in avatarStyles"
                :key="style.value"
                class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors text-center"
                :class="selectedStyle === style.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent'"
                @click="selectedStyle = style.value"
              >
                <span class="text-xl">{{ style.icon }}</span>
                <span class="text-xs text-muted-foreground leading-tight">{{ style.label }}</span>
              </button>
            </div>
          </div>

          <!-- 自定义描述（可选） -->
          <div class="space-y-2">
            <Label for="ai-prompt">
              自定义描述
              <span class="text-xs text-muted-foreground ml-1">（可选）</span>
            </Label>
            <Input
              id="ai-prompt"
              v-model="aiPrompt"
              placeholder="例如：戴眼镜的程序员、蓝色头发的女孩..."
              :disabled="aiGenerating"
            />
            <p class="text-xs text-muted-foreground">留空则使用风格默认提示词生成</p>
          </div>

          <!-- 生成结果预览 -->
          <div v-if="aiGeneratedUrl" class="flex justify-center">
            <div class="relative">
              <img
                :src="aiGeneratedUrl"
                alt="AI 生成的头像"
                class="w-32 h-32 rounded-full object-cover border-4 border-primary/20 shadow-lg"
              />
              <div class="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                <Sparkles class="w-3 h-3 text-primary-foreground" />
              </div>
            </div>
          </div>

          <!-- 生成中占位 -->
          <div v-if="aiGenerating" class="flex items-center justify-center py-8">
            <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
          </div>

          <DialogFooter class="gap-2">
            <Button variant="outline" size="sm" @click="handleCancel">取消</Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="aiGenerating"
              @click="handleAiGenerate"
            >
              <Sparkles class="w-4 h-4 mr-2" />
              {{ aiGeneratedUrl ? '重新生成' : '开始生成' }}
            </Button>
            <Button
              v-if="aiGeneratedUrl"
              size="sm"
              :disabled="aiGenerating || loading"
              @click="handleApplyAiAvatar"
            >
              <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
              使用此头像
            </Button>
          </DialogFooter>
        </TabsContent>

        <!-- ===== 默认头像 ===== -->
        <TabsContent value="default" class="space-y-4 mt-4">
          <div class="text-center space-y-4">
            <p class="text-sm text-muted-foreground">
              使用基于您用户名首字母自动生成的彩色头像
            </p>

            <!-- 预览 -->
            <div class="flex justify-center">
              <div
                class="w-28 h-28 rounded-full flex items-center justify-center shadow-lg text-5xl font-bold text-white/95"
                :style="{ backgroundColor: defaultAvatarColor }"
              >
                {{ defaultAvatarLetter }}
              </div>
            </div>

            <p class="text-xs text-muted-foreground">头像颜色根据您的邮箱自动分配，无法自定义</p>
          </div>

          <DialogFooter class="gap-2">
            <Button variant="outline" size="sm" @click="handleCancel">取消</Button>
            <Button size="sm" :disabled="loading" @click="handleApplyDefault">
              <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
              使用默认头像
            </Button>
          </DialogFooter>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Upload, Loader2, RotateCcw, RotateCw, FlipHorizontal, FlipVertical,
  RefreshCw, Sparkles, Smile
} from 'lucide-vue-next'
import { Cropper, CircleStencil } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
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

interface Props {
  open: boolean
  loading?: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'crop', blob: Blob): void
  (e: 'applied'): void
}

const props = withDefaults(defineProps<Props>(), { loading: false })
const emit = defineEmits<Emits>()
const { toast } = useToast()
const authStore = useAuthStore()

// 头像风格选项
const avatarStyles = [
  { value: 'cartoon', label: '卡通', icon: '🎨' },
  { value: 'anime', label: '动漫', icon: '✨' },
  { value: 'pixel', label: '像素', icon: '🕹️' },
  { value: 'watercolor', label: '水彩', icon: '🖌️' },
  { value: 'sketch', label: '素描', icon: '✏️' }
] as const

// ===== 通用状态 =====
const activeMode = ref<'upload' | 'ai' | 'default'>('upload')

// ===== 上传 / 裁剪状态 =====
const fileInput = ref<HTMLInputElement | null>(null)
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const imageSrc = ref<string | null>(null)
const imageType = ref<string>('image/jpeg')

// ===== AI 生成状态 =====
const selectedStyle = ref<string>('cartoon')
const aiPrompt = ref('')
const aiGenerating = ref(false)
const aiGeneratedUrl = ref<string | null>(null)

// ===== 默认头像计算 =====
const AVATAR_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FF9800', '#FF5722', '#795548', '#607D8B'
]

function pickColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const defaultAvatarLetter = computed(() => {
  const seed = authStore.user?.fullName || authStore.user?.username || authStore.user?.email || 'U'
  return seed.trim().charAt(0).toUpperCase()
})

const defaultAvatarColor = computed(() => {
  return pickColor(authStore.user?.email || authStore.user?.id || 'user')
})

// ===== Dialog 逻辑 =====
function handleOpenChange(value: boolean) {
  emit('update:open', value)
}

watch(() => props.open, (newVal) => {
  if (!newVal) resetState()
})

function handleCancel() {
  emit('update:open', false)
}

function resetState() {
  imageSrc.value = null
  aiGeneratedUrl.value = null
  aiPrompt.value = ''
  aiGenerating.value = false
  if (fileInput.value) fileInput.value.value = ''
}

// ===== 上传图片逻辑 =====
function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) loadImage(file)
}

function handleDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) loadImage(file)
}

function loadImage(file: File) {
  if (file.size > 10 * 1024 * 1024) {
    toast({ title: '文件过大', description: '图片大小不能超过 10MB', variant: 'destructive' })
    return
  }
  imageType.value = file.type || 'image/jpeg'
  const reader = new FileReader()
  reader.onload = (e) => { imageSrc.value = e.target?.result as string }
  reader.readAsDataURL(file)
}

function clearImage() {
  imageSrc.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function rotateLeft() { cropperRef.value?.rotate(-90) }
function rotateRight() { cropperRef.value?.rotate(90) }
function flipHorizontal() { cropperRef.value?.flip(true, false) }
function flipVertical() { cropperRef.value?.flip(false, true) }
function resetImage() { cropperRef.value?.reset() }

function handleCrop() {
  const { canvas } = cropperRef.value?.getResult() || {}
  if (canvas) {
    canvas.toBlob((blob) => {
      if (blob) emit('crop', blob)
    }, imageType.value, 0.9)
  }
}

// ===== AI 生成逻辑 =====
async function handleAiGenerate() {
  aiGenerating.value = true
  aiGeneratedUrl.value = null

  try {
    const res = await $fetch<{ success: boolean; avatarUrl?: string; message?: string }>(
      '/api/v1/user/avatar/generate',
      {
        method: 'POST',
        body: {
          style: selectedStyle.value,
          prompt: aiPrompt.value.trim() || undefined
        }
      }
    )

    if (res.success && res.avatarUrl) {
      // 生成成功后先预览
      aiGeneratedUrl.value = res.avatarUrl
      // 同步更新 store
      if (authStore.user) {
        authStore.user.avatarUrl = res.avatarUrl
      }
      toast({ title: 'AI 头像生成成功', variant: 'success' })
      emit('applied')
      emit('update:open', false)
    } else {
      toast({ title: res.message || 'AI 生成失败', variant: 'destructive' })
    }
  } catch {
    toast({ title: '生成失败，请检查网络或 API 配置', variant: 'destructive' })
  } finally {
    aiGenerating.value = false
  }
}

async function handleApplyAiAvatar() {
  // 已经在生成时保存，直接关闭
  emit('update:open', false)
}

// ===== 默认头像逻辑 =====
async function handleApplyDefault() {
  try {
    const res = await $fetch<{ success: boolean; avatarUrl?: string; message?: string }>(
      '/api/v1/user/avatar/default',
      { method: 'POST' }
    )

    if (res.success && res.avatarUrl) {
      if (authStore.user) {
        authStore.user.avatarUrl = res.avatarUrl
      }
      toast({ title: '默认头像已设置', variant: 'success' })
      emit('applied')
      emit('update:open', false)
    } else {
      toast({ title: res.message || '设置失败', variant: 'destructive' })
    }
  } catch {
    toast({ title: '设置失败，请重试', variant: 'destructive' })
  }
}
</script>

<style scoped>
.cropper-container {
  width: 100%;
  aspect-ratio: 1;
  max-height: 400px;
  margin: 0 auto;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #1a1a1a;
}

.cropper {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
}

:deep(.vue-advanced-cropper) {
  background: #1a1a1a;
}

:deep(.vue-advanced-cropper__background) {
  background: #1a1a1a;
}

:deep(.vue-advanced-cropper__foreground) {
  background: rgba(0, 0, 0, 0.6);
}

:deep(.vue-circle-stencil__handler) {
  display: none;
}
</style>
