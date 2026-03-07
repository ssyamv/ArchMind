<template>
  <div class="logic-map-viewer">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>

    <div v-else-if="error" class="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
      <p class="text-sm text-destructive">{{ error }}</p>
      <pre v-if="code" class="mt-2 text-xs text-muted-foreground overflow-x-auto">{{ code }}</pre>
    </div>

    <div v-else-if="svgContent" ref="containerRef" class="mermaid-container" v-html="svgContent" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import mermaid from 'mermaid'

const props = defineProps<{
  code: string
  theme?: 'default' | 'dark' | 'forest' | 'neutral'
}>()

const containerRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const svgContent = ref<string | null>(null)

async function renderMermaid() {
  if (!props.code) {
    error.value = 'Mermaid 代码为空'
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: props.theme || 'default',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    })

    const { svg } = await mermaid.render(`mermaid-${Date.now()}`, props.code)
    svgContent.value = svg
  } catch (e: any) {
    console.warn('[LogicMapViewer] Mermaid 渲染失败', e)
    error.value = `渲染失败：${e?.message || '未知错误'}`
  } finally {
    loading.value = false
  }
}

watch(() => props.code, renderMermaid)
watch(() => props.theme, renderMermaid)

onMounted(() => {
  if (props.code) {
    renderMermaid()
  }
})

defineExpose({ containerRef })
</script>

<style scoped>
.mermaid-container {
  @apply w-full overflow-x-auto;
}

.mermaid-container :deep(svg) {
  @apply max-w-full h-auto;
}
</style>
