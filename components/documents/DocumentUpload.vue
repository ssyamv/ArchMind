<template>
  <div class="document-upload space-y-4">
    <div
      class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
      :class="uploading ? 'pointer-events-none opacity-60' : ''"
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
        <Loader2 class="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
        <Progress :model-value="uploadProgress" class="mb-2" />
        <p class="text-muted-foreground text-sm">
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
import { CloudUpload, AlertCircle, Loader2 } from 'lucide-vue-next'
import { useToast } from '~/components/ui/toast/use-toast'

const { t } = useI18n()
const { toast } = useToast()

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

function uploadFile (file: File) {
  error.value = ''
  uploading.value = true
  uploadProgress.value = 0

  const formData = new FormData()
  formData.append('file', file)
  if (props.workspaceId) {
    formData.append('workspace_id', props.workspaceId)
  }

  const xhr = new XMLHttpRequest()

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      uploadProgress.value = Math.round((e.loaded / e.total) * 100)
    }
  })

  xhr.addEventListener('load', () => {
    uploading.value = false
    uploadProgress.value = 0
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const response = JSON.parse(xhr.responseText)
        toast({
          title: t('documents.upload.successTitle'),
          description: t('documents.upload.successDesc'),
        })
        emit('uploaded', response.data.id)
      } catch {
        error.value = t('documents.upload.uploadFailed')
      }
    } else {
      try {
        const res = JSON.parse(xhr.responseText)
        error.value = res.message || t('documents.upload.uploadFailed')
      } catch {
        error.value = t('documents.upload.uploadFailed')
      }
    }
  })

  xhr.addEventListener('error', () => {
    uploading.value = false
    uploadProgress.value = 0
    error.value = t('documents.upload.uploadFailed')
  })

  xhr.open('POST', '/api/v1/documents/upload')
  xhr.send(formData)
}
</script>
