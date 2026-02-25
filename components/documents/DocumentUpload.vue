<template>
  <div class="document-upload space-y-4">
    <div
      class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
      :class="uploading ? 'pointer-events-none' : ''"
      @dragover.prevent
      @drop.prevent="handleDrop"
      @click="fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,.docx,.md,.markdown"
        class="hidden"
        @change="handleFileSelect"
      >

      <div v-if="!uploading">
        <CloudUpload class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p class="text-foreground mb-2">
          {{ $t('documents.upload.dragDrop') }}
        </p>
        <p class="text-sm text-muted-foreground mt-2">
          {{ $t('documents.upload.supportedFormats') }}
        </p>
      </div>

      <!-- 上传阶段 -->
      <div v-else>
        <Progress :model-value="uploadProgress" class="mb-2" />
        <p class="text-muted-foreground">
          {{ $t('documents.upload.uploading', { progress: uploadProgress }) }}
        </p>
      </div>
    </div>

    <!-- 错误提示 -->
    <Alert v-if="error" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>{{ $t('common.error') }}</AlertTitle>
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { CloudUpload, AlertCircle } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps<{
  workspaceId?: string
}>()

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const uploadProgress = ref(0)
const error = ref('')

const emit = defineEmits<{
  uploaded: [documentId: string];
}>()

function handleFileSelect (event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadFile(file)
  }
}

function handleDrop (event: DragEvent) {
  const file = event.dataTransfer?.files[0]
  if (file) {
    uploadFile(file)
  }
}

async function uploadFile (file: File) {
  error.value = ''
  uploading.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('file', file)
    if (props.workspaceId) {
      formData.append('workspace_id', props.workspaceId)
    }

    const response = await $fetch<{ success: boolean; data: { id: string } }>('/api/v1/documents/upload', {
      method: 'POST',
      body: formData
    })

    uploadProgress.value = 100
    uploading.value = false

    // 上传成功后立即通知父组件刷新列表，向量化在后台进行
    emit('uploaded', response.data.id)
  } catch (err: any) {
    error.value = err.message || t('documents.upload.uploadFailed')
    uploading.value = false
  } finally {
    uploadProgress.value = 0
  }
}
</script>
