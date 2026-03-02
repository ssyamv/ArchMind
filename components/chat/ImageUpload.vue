<template>
  <div class="flex items-center gap-1.5">
    <!-- 上传按钮 -->
    <Popover v-if="images.length > 0">
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          :disabled="disabled"
          class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background/60 relative"
        >
          <ImageIcon class="w-3.5 h-3.5" />
          <span>{{ images.length }}</span>
          <!-- 数量徽章 -->
          <span
            class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center"
          >
            {{ images.length }}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-2" align="start">
        <div class="grid grid-cols-3 gap-2 max-w-[240px]">
          <div
            v-for="(image, index) in images"
            :key="image.id"
            class="relative group"
          >
            <img
              :src="getImagePreview(image)"
              :alt="image.name || 'Uploaded image'"
              class="w-20 h-20 rounded object-cover border border-border"
            >
            <button
              class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              @click="removeImage(index)"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>{{ images.length }} / {{ maxImages }}</span>
          <Button
            v-if="images.length < maxImages"
            variant="ghost"
            size="sm"
            class="h-6 text-xs"
            @click="triggerFileInput"
          >
            添加更多
          </Button>
        </div>
      </PopoverContent>
    </Popover>

    <!-- 无图片时的上传按钮 -->
    <Button
      v-else
      variant="ghost"
      size="sm"
      :disabled="disabled"
      class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background/60"
      @click="triggerFileInput"
    >
      <ImageIcon class="w-3.5 h-3.5" />
      <span>{{ $t('chat.uploadImage') }}</span>
    </Button>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
      multiple
      class="hidden"
      @change="handleFileChange"
    >
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ImageIcon, X } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import type { ImageAttachment } from '~/types/conversation'

const props = defineProps<{
  disabled?: boolean
  maxImages?: number
  maxSizeKB?: number
}>()

const emit = defineEmits<{
  update: [images: ImageAttachment[]]
  error: [message: string]
}>()

const fileInputRef = ref<HTMLInputElement>()
const images = ref<ImageAttachment[]>([])

const maxImages = props.maxImages || 5
const maxSizeKB = props.maxSizeKB || 5120 // 默认 5MB

function triggerFileInput() {
  fileInputRef.value?.click()
}

function processFile(file: File): Promise<void> {
  return new Promise((resolve) => {
    if (file.size > maxSizeKB * 1024) {
      emit('error', `图片 ${file.name} 超过 ${maxSizeKB / 1024}MB 限制`)
      resolve()
      return
    }

    if (images.value.length >= maxImages) {
      emit('error', `最多只能上传 ${maxImages} 张图片`)
      resolve()
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      // 移除 data:image/xxx;base64, 前缀
      const base64Data = base64.split(',')[1]

      const imageAttachment: ImageAttachment = {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'base64',
        data: base64Data,
        mimeType: file.type,
        name: file.name,
        size: file.size
      }

      images.value.push(imageAttachment)
      emit('update', images.value)
      resolve()
    }
    reader.onerror = () => resolve()
    reader.readAsDataURL(file)
  })
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    await processFile(file)
  }

  // 清空 input，允许重复选择同一文件
  target.value = ''
}

function removeImage(index: number) {
  images.value.splice(index, 1)
  emit('update', images.value)
}

function getImagePreview(image: ImageAttachment): string {
  if (image.type === 'base64') {
    return `data:${image.mimeType};base64,${image.data}`
  }
  return image.data
}

// 暴露方法给父组件
defineExpose({
  clear: () => {
    images.value = []
    emit('update', [])
  },
  pasteFiles: async (files: File[]) => {
    for (const file of files) {
      await processFile(file)
    }
  }
})
</script>
