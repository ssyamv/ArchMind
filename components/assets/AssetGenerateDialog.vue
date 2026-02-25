<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Sparkles, Loader2, ImageIcon } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select'
import { useToast } from '~/components/ui/toast/use-toast'
import type { Asset } from '~/types/asset'

interface ImageModel {
  modelId: string
  modelName: string
  providerId: string
  providerName: string
  description: string
  capabilities: {
    maxResolution: string
    supportedSizes: string[]
    supportsEdit: boolean
    supportsInpaint: boolean
  }
  costEstimate: {
    perImage: string
  }
  available: boolean
}

const props = defineProps<{
  open: boolean
  prdId?: string | null
  prdContent?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: [assets: Asset[]]
}>()

const { t } = useI18n()
const { toast } = useToast()

// 表单状态
const prompt = ref('')
const negativePrompt = ref('')
const selectedModelId = ref('wanx2.1-t2i-turbo')
const selectedSize = ref('1024*1024')
const count = ref(1)
const isGenerating = ref(false)

// 可用模型
const models = ref<ImageModel[]>([])
const isLoadingModels = ref(false)

// 计算属性
const availableModels = computed(() => models.value.filter(m => m.available))
const currentModel = computed(() => models.value.find(m => m.modelId === selectedModelId.value))
const supportedSizes = computed(() => currentModel.value?.capabilities.supportedSizes || ['1024*1024'])

// 从 PRD 内容提取提示词建议
const suggestedPrompt = computed(() => {
  if (!props.prdContent) return ''
  // 简单提取前 100 字符作为建议
  const content = props.prdContent.replace(/[#*`]/g, '').trim()
  return content.substring(0, 200) + (content.length > 200 ? '...' : '')
})

// 加载可用模型
async function loadModels() {
  isLoadingModels.value = true
  try {
    const response = await $fetch<{ success: boolean; data?: { models: ImageModel[]; defaultModel?: string } }>('/api/v1/assets/models')
    if (response.success && response.data) {
      models.value = response.data.models
      if (response.data.defaultModel) {
        selectedModelId.value = response.data.defaultModel
      }
    }
  } catch (error) {
    console.error('Failed to load image models:', error)
  } finally {
    isLoadingModels.value = false
  }
}

// 监听对话框打开
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadModels()
    // 不再自动填充 PRD 内容，让用户自己输入
  }
})

// 重置表单
function resetForm() {
  prompt.value = ''
  negativePrompt.value = ''
  selectedModelId.value = 'wanx2.1-t2i-turbo'
  selectedSize.value = '1024*1024'
  count.value = 1
}

// 关闭对话框
function handleClose(value: boolean) {
  emit('update:open', value)
  if (!value) {
    resetForm()
  }
}

// 生成图片
async function handleGenerate() {
  if (!prompt.value.trim()) {
    toast({
      title: t('common.error'),
      description: t('assets.aiGenerateDialog.prompt') + ' is required',
      variant: 'destructive'
    })
    return
  }

  isGenerating.value = true

  try {
    const response = await $fetch<{ success: boolean; data?: { assets: Asset[] }; message?: string }>('/api/v1/assets/generate', {
      method: 'POST',
      body: {
        prompt: prompt.value,
        negativePrompt: negativePrompt.value || undefined,
        modelId: selectedModelId.value,
        size: selectedSize.value,
        count: count.value,
        prdId: props.prdId || undefined
      }
    })

    if (response.success && response.data?.assets?.length) {
      toast({
        title: t('assets.aiGenerateDialog.generateSuccess'),
        description: `Generated ${response.data.assets.length} image(s)`,
        variant: 'success'
      })
      emit('success', response.data.assets)
      handleClose(false)
    } else {
      throw new Error(response.message || 'Generation failed')
    }
  } catch (error: any) {
    console.error('Image generation error:', error)
    toast({
      title: t('assets.aiGenerateDialog.generateFailed'),
      description: error.message || error.data?.message || 'Unknown error',
      variant: 'destructive'
    })
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Sparkles class="w-5 h-5 text-primary" />
          {{ $t('assets.aiGenerateDialog.title') }}
        </DialogTitle>
        <DialogDescription>
          {{ $t('assets.aiGenerateDialog.description') }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- 模型选择 -->
        <div class="space-y-2">
          <Label>{{ $t('assets.selectModel') }}</Label>
          <Select v-model="selectedModelId" :disabled="isGenerating || isLoadingModels">
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="model in availableModels"
                :key="model.modelId"
                :value="model.modelId"
              >
                <div class="flex flex-col">
                  <span>{{ model.modelName }}</span>
                  <span class="text-xs text-muted-foreground">{{ model.costEstimate.perImage }}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="currentModel" class="text-xs text-muted-foreground">
            {{ currentModel.description }}
          </p>
        </div>

        <!-- 提示词 -->
        <div class="space-y-2">
          <Label>{{ $t('assets.aiGenerateDialog.prompt') }}</Label>
          <Textarea
            v-model="prompt"
            :placeholder="$t('assets.aiGenerateDialog.promptPlaceholder')"
            :disabled="isGenerating"
            rows="4"
            class="resize-none"
          />
          <p class="text-xs text-muted-foreground">
            {{ $t('assets.aiGenerateDialog.promptHint') }}
          </p>
        </div>

        <!-- 负面提示词 -->
        <div class="space-y-2">
          <Label>{{ $t('assets.negativePrompt') }} ({{ $t('assets.optional') }})</Label>
          <Input
            v-model="negativePrompt"
            :placeholder="$t('assets.negativePromptPlaceholder')"
            :disabled="isGenerating"
          />
        </div>

        <!-- 图片尺寸 -->
        <div class="space-y-2">
          <Label>{{ $t('assets.imageSize') }}</Label>
          <Select v-model="selectedSize" :disabled="isGenerating">
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="size in supportedSizes"
                :key="size"
                :value="size"
              >
                {{ size.replace('*', ' × ') }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 生成数量 -->
        <div class="space-y-2">
          <Label>{{ $t('assets.aiGenerateDialog.count') }}</Label>
          <Select v-model="count" :disabled="isGenerating">
            <SelectTrigger class="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="n in 4" :key="n" :value="n">
                {{ n }} {{ n === 1 ? 'image' : 'images' }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="isGenerating"
          @click="handleClose(false)"
        >
          {{ $t('common.cancel') }}
        </Button>
        <Button
          :disabled="isGenerating || !prompt.trim() || availableModels.length === 0"
          @click="handleGenerate"
        >
          <Loader2 v-if="isGenerating" class="w-4 h-4 mr-2 animate-spin" />
          <ImageIcon v-else class="w-4 h-4 mr-2" />
          {{ isGenerating ? $t('assets.aiGenerateDialog.generating') : $t('assets.aiGenerate') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
