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

      <div v-if="!uploading && !processing">
        <CloudUpload class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p class="text-foreground mb-2">
          {{ $t('documents.upload.dragDrop') }}
        </p>
        <p class="text-sm text-muted-foreground mt-2">
          {{ $t('documents.upload.supportedFormats') }}
        </p>
      </div>

      <!-- 上传阶段 -->
      <div v-else-if="uploading">
        <Progress :model-value="uploadProgress" class="mb-2" />
        <p class="text-muted-foreground">
          {{ $t('documents.upload.uploading', { progress: uploadProgress }) }}
        </p>
      </div>

      <!-- 向量化处理阶段 -->
      <div v-else-if="processing">
        <div class="flex items-center justify-center mb-3">
          <Loader2 class="w-8 h-8 animate-spin text-primary" />
        </div>
        <Progress :model-value="sseProgress" class="mb-2" />
        <p class="text-sm text-muted-foreground">
          <template v-if="sseStatus === 'pending'">{{ $t('documents.upload.queued') }}</template>
          <template v-else-if="sseStatus === 'processing'">
            {{ $t('documents.upload.vectorizing') }}
            <span v-if="sseChunksCount && sseVectorsCount">
              ({{ sseVectorsCount }}/{{ sseChunksCount }} chunks)
            </span>
          </template>
          <template v-else>{{ $t('documents.upload.processing') }}</template>
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
import { CloudUpload, AlertCircle, Loader2 } from 'lucide-vue-next'
import { useDocumentSSE } from '~/composables/useDocumentSSE'

const { t } = useI18n()

const props = defineProps<{
  workspaceId?: string
}>()

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const uploadProgress = ref(0)
const error = ref('')
const processing = ref(false)

const {
  status: sseStatus,
  progress: sseProgress,
  chunksCount: sseChunksCount,
  vectorsCount: sseVectorsCount,
  isCompleted: sseCompleted,
  isFailed: sseFailed,
  subscribe: sseSubscribe,
  reset: sseReset
} = useDocumentSSE()

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
  processing.value = false
  sseReset()

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

    // 上传成功后订阅 SSE，展示向量化进度
    const documentId = response.data.id
    processing.value = true

    sseSubscribe(documentId, (statusEvent) => {
      if (statusEvent.status === 'completed' || statusEvent.status === 'failed') {
        processing.value = false
        emit('uploaded', documentId)
      }
    })
  } catch (err: any) {
    error.value = err.message || t('documents.upload.uploadFailed')
    uploading.value = false
  } finally {
    uploadProgress.value = 0
  }
}

// 监听 SSE 完成/失败（作为 sseSubscribe 回调的补充）
watch([sseCompleted, sseFailed], ([completed, failed]) => {
  if ((completed || failed) && processing.value) {
    processing.value = false
  }
})
</script>
