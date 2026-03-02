<template>
  <div class="flex flex-col h-screen bg-background">
    <!-- 顶部导航栏 -->
    <header class="flex-shrink-0 flex items-center gap-3 px-4 h-14 border-b border-border bg-card">
      <Button variant="ghost" size="sm" class="gap-1.5 shrink-0" @click="goBack">
        <ArrowLeft class="w-4 h-4" />
        返回
      </Button>

      <div class="flex items-center gap-2 text-sm font-medium shrink-0">
        <GitCompare class="w-4 h-4 text-primary" />
        PRD 版本对比
      </div>

      <div class="flex-1" />

      <!-- 选择两个版本（有版本列表时显示） -->
      <template v-if="versions.length >= 2">
        <div class="flex items-center gap-2">
          <Badge variant="secondary" class="shrink-0">版本 A</Badge>
          <Select v-model="selectedIdA" @update:model-value="onSelectionChange">
            <SelectTrigger class="w-[180px] text-sm">
              <SelectValue placeholder="选择版本..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="v in versions"
                :key="v.id"
                :value="v.id"
                :disabled="v.id === selectedIdB"
              >
                {{ v.versionLabel }} · {{ formatDate(v.createdAt) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <GitCompare class="w-4 h-4 text-muted-foreground shrink-0" />

        <div class="flex items-center gap-2">
          <Badge variant="outline" class="shrink-0">版本 B</Badge>
          <Select v-model="selectedIdB" @update:model-value="onSelectionChange">
            <SelectTrigger class="w-[180px] text-sm">
              <SelectValue placeholder="选择版本..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="v in versions"
                :key="v.id"
                :value="v.id"
                :disabled="v.id === selectedIdA"
              >
                {{ v.versionLabel }} · {{ formatDate(v.createdAt) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </template>
    </header>

    <!-- 加载中 -->
    <div v-if="versionsLoading" class="flex-1 flex items-center justify-center text-muted-foreground">
      <RefreshCw class="w-5 h-5 animate-spin mr-2" />
      <span class="text-sm">加载版本列表...</span>
    </div>

    <!-- 版本不足 -->
    <div
      v-else-if="versions.length < 2"
      class="flex-1 flex items-center justify-center text-muted-foreground"
    >
      <div class="text-center">
        <GitCompare class="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p v-if="isSnapshotMode" class="text-sm mb-1">该 PRD 暂无足够的命名版本可对比</p>
        <p v-else class="text-sm mb-1">该 PRD 暂无其他版本可对比</p>
        <p v-if="isSnapshotMode" class="text-xs opacity-60">在生成页点击「保存版本」按钮可创建命名版本</p>
        <p v-else class="text-xs opacity-60">在生成时选择"基于此版本重新生成"可创建新版本</p>
      </div>
    </div>

    <!-- 提示：未选择两个版本 -->
    <div
      v-else-if="!selectedIdA || !selectedIdB"
      class="flex-1 flex items-center justify-center text-muted-foreground"
    >
      <div class="text-center">
        <GitCompare class="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p class="text-sm mb-1">请在顶部选择要对比的版本 A 和版本 B</p>
        <p class="text-xs opacity-60">支持按章节高亮显示新增、删除和修改的内容</p>
      </div>
    </div>

    <!-- 对比面板 -->
    <ComparePanel
      v-else
      :prd-id-a="selectedIdA!"
      :prd-id-b="selectedIdB!"
      :mode="isSnapshotMode ? 'snapshot' : 'prd'"
      class="flex-1 min-h-0"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft, GitCompare, RefreshCw } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import ComparePanel from '~/components/prd/ComparePanel.vue'

definePageMeta({
  layout: false
})

const route = useRoute()
const router = useRouter()

interface VersionItem {
  id: string
  title: string
  parentId?: string
  modelUsed: string
  createdAt: string
  updatedAt: string
  versionLabel: string
}

const versions = ref<VersionItem[]>([])
const versionsLoading = ref(false)

// root 从 URL 读取，不允许用户在页面上切换
const selectedRootId = ref<string | undefined>((route.query.root as string) || undefined)
const selectedIdA = ref<string | undefined>((route.query.a as string) || undefined)
const selectedIdB = ref<string | undefined>((route.query.b as string) || undefined)

// snapshot mode：来自 PRDSnapshotHistory 的对比跳转
const isSnapshotMode = computed(() => route.query.mode === 'snapshot')

function goBack () {
  router.back()
}

function formatDate (dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function onSelectionChange () {
  router.replace({
    query: {
      ...route.query,
      a: selectedIdA.value || undefined,
      b: selectedIdB.value || undefined
    }
  })
}

onMounted(async () => {
  if (!selectedRootId.value) { return }

  versionsLoading.value = true
  try {
    if (isSnapshotMode.value) {
      const res = await $fetch<{ success: boolean; data: any[] }>(`/api/v1/prd/${selectedRootId.value}/snapshots?type=manual`)
      if (res.success) {
        versions.value = (res.data || []).map((s: any) => ({
          id: s.id,
          title: s.tag || '未命名版本',
          parentId: undefined,
          modelUsed: '',
          createdAt: s.createdAt,
          updatedAt: s.createdAt,
          versionLabel: s.tag || formatDate(s.createdAt)
        }))
        // 若 URL 未指定 a/b，自动选择最新两个版本
        if (versions.value.length >= 2 && !selectedIdA.value && !selectedIdB.value) {
          selectedIdA.value = versions.value[1].id
          selectedIdB.value = versions.value[0].id
          onSelectionChange()
        }
      }
    } else {
      const res = await $fetch<{ success: boolean; data: VersionItem[] }>(`/api/v1/prd/${selectedRootId.value}/versions`)
      if (res.success) {
        versions.value = res.data || []
        if (versions.value.length >= 2 && !selectedIdA.value && !selectedIdB.value) {
          selectedIdA.value = versions.value[1].id
          selectedIdB.value = versions.value[0].id
          onSelectionChange()
        }
      }
    }
  } catch {
    // 静默失败
  } finally {
    versionsLoading.value = false
  }
})
</script>
