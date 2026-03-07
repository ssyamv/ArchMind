<template>
  <div class="logic-map-editor flex flex-col gap-4">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" @click="handleCopy">
          <Copy class="w-4 h-4 mr-1" />
          复制代码
        </Button>
        <Button size="sm" variant="outline" @click="handleReset" :disabled="!hasChanges">
          <RotateCcw class="w-4 h-4 mr-1" />
          重置
        </Button>
      </div>
      <Button size="sm" @click="handleSave" :disabled="!hasChanges || saving">
        <Loader2 v-if="saving" class="w-4 h-4 mr-1 animate-spin" />
        <Save v-else class="w-4 h-4 mr-1" />
        保存
      </Button>
    </div>

    <!-- 代码编辑器 -->
    <div class="border rounded-lg overflow-hidden">
      <textarea
        v-model="localCode"
        class="w-full h-64 p-4 font-mono text-sm bg-muted/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="在此编辑 Mermaid 代码..."
        @input="handleInput"
      />
    </div>

    <!-- 实时预览 -->
    <div class="border rounded-lg p-4 bg-background">
      <h4 class="text-sm font-medium mb-3">实时预览</h4>
      <LogicMapViewer :code="localCode" :theme="theme" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Copy, RotateCcw, Save, Loader2 } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { useToast } from '~/components/ui/toast/use-toast'
import LogicMapViewer from './LogicMapViewer.vue'

const props = defineProps<{
  code: string
  theme?: 'default' | 'dark' | 'forest' | 'neutral'
}>()

const emit = defineEmits<{
  save: [code: string]
}>()

const { toast } = useToast()

const localCode = ref(props.code)
const originalCode = ref(props.code)
const saving = ref(false)

const hasChanges = computed(() => localCode.value !== originalCode.value)

function handleInput() {
  // 实时预览会自动触发
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(localCode.value)
    toast({ title: '已复制到剪贴板' })
  } catch (e) {
    toast({ title: '复制失败', variant: 'destructive' })
  }
}

function handleReset() {
  localCode.value = originalCode.value
  toast({ title: '已重置为原始代码' })
}

async function handleSave() {
  saving.value = true
  try {
    emit('save', localCode.value)
    originalCode.value = localCode.value
    toast({ title: '保存成功' })
  } catch (e: any) {
    toast({ title: '保存失败', description: e?.message, variant: 'destructive' })
  } finally {
    saving.value = false
  }
}

watch(() => props.code, (newCode) => {
  localCode.value = newCode
  originalCode.value = newCode
})
</script>
