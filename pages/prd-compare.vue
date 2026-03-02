<template>
  <div class="flex flex-col h-screen bg-background">
    <!-- 顶部导航栏 -->
    <header class="flex-shrink-0 flex items-center gap-4 px-4 h-14 border-b border-border bg-card">
      <Button variant="ghost" size="sm" class="gap-1.5" @click="goBack">
        <ArrowLeft class="w-4 h-4" />
        返回
      </Button>

      <div class="flex items-center gap-2 text-sm font-medium">
        <GitCompare class="w-4 h-4 text-primary" />
        PRD 版本对比
      </div>

      <div class="flex-1" />

      <!-- 版本 A 选择 -->
      <div class="flex items-center gap-2">
        <Badge variant="secondary" class="shrink-0">版本 A</Badge>
        <select
          v-model="selectedIdA"
          class="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground min-w-[180px] max-w-[240px]"
          @change="onSelectionChange"
        >
          <option value="">请选择 PRD...</option>
          <option
            v-for="prd in allPRDs"
            :key="prd.id"
            :value="prd.id"
            :disabled="prd.id === selectedIdB"
          >
            {{ prd.title || '未命名' }}
          </option>
        </select>
      </div>

      <GitCompare class="w-4 h-4 text-muted-foreground" />

      <!-- 版本 B 选择 -->
      <div class="flex items-center gap-2">
        <Badge variant="outline" class="shrink-0">版本 B</Badge>
        <select
          v-model="selectedIdB"
          class="text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground min-w-[180px] max-w-[240px]"
          @change="onSelectionChange"
        >
          <option value="">请选择 PRD...</option>
          <option
            v-for="prd in allPRDs"
            :key="prd.id"
            :value="prd.id"
            :disabled="prd.id === selectedIdA"
          >
            {{ prd.title || '未命名' }}
          </option>
        </select>
      </div>
    </header>

    <!-- 提示：未选择 PRD -->
    <div
      v-if="!selectedIdA || !selectedIdB"
      class="flex-1 flex items-center justify-center text-muted-foreground"
    >
      <div class="text-center">
        <GitCompare class="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p class="text-sm mb-1">请在顶部分别选择要对比的两个 PRD 版本</p>
        <p class="text-xs opacity-60">支持按章节高亮显示新增、删除和修改的内容</p>
      </div>
    </div>

    <!-- 对比面板 -->
    <ComparePanel
      v-else
      :prd-id-a="selectedIdA"
      :prd-id-b="selectedIdB"
      class="flex-1 min-h-0"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ArrowLeft, GitCompare } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import ComparePanel from '~/components/prd/ComparePanel.vue'

definePageMeta({
  layout: false // 使用全屏布局，不含侧边栏
})

const route = useRoute()
const router = useRouter()

interface PRDItem {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

const allPRDs = ref<PRDItem[]>([])
const selectedIdA = ref((route.query.a as string) || '')
const selectedIdB = ref((route.query.b as string) || '')

function goBack () {
  router.back()
}

function onSelectionChange () {
  // 同步 URL query 参数
  router.replace({
    query: {
      a: selectedIdA.value || undefined,
      b: selectedIdB.value || undefined
    }
  })
}

async function loadPRDList () {
  try {
    const res = await $fetch<{ success: boolean; data: { prds: PRDItem[] } }>('/api/v1/prd', {
      query: { page: 1, limit: 200 }
    })
    if (res.success) {
      allPRDs.value = res.data.prds || []
    }
  } catch {
    // 静默失败
  }
}

onMounted(loadPRDList)
</script>
