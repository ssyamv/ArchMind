<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BarChart2, FileText, TrendingUp, Search, AlertCircle, RefreshCw } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select'

interface Props {
  workspaceId: string
}

const props = defineProps<Props>()

interface TopDocument {
  documentId: string
  documentTitle: string
  citationCount: number
  averageSimilarity: number
}

interface ZeroCitationDocument {
  documentId: string
  documentTitle: string
}

interface RetrievalStats {
  totalRetrievals: number
  uniqueDocumentsCited: number
  averageSimilarity: number
  hitRate: number
  topDocuments: TopDocument[]
  zeroCitationDocuments: ZeroCitationDocument[]
}

const days = ref('7')
const isLoading = ref(false)
const stats = ref<RetrievalStats | null>(null)
const error = ref<string | null>(null)

async function fetchStats () {
  if (!props.workspaceId) return
  isLoading.value = true
  error.value = null
  try {
    const res = await $fetch<{ success: boolean; data: RetrievalStats }>(
      `/api/v1/stats/rag-retrieval?workspaceId=${props.workspaceId}&days=${days.value}`
    )
    if (res.success) {
      stats.value = res.data
    }
  } catch (err: any) {
    error.value = err?.data?.message ?? '获取统计数据失败'
  } finally {
    isLoading.value = false
  }
}

// 监听 days 变化自动刷新
watch(days, fetchStats, { immediate: true })

const hitRatePercent = computed(() =>
  stats.value ? Math.round(stats.value.hitRate * 100) : 0
)

const avgSimilarityPercent = computed(() =>
  stats.value ? Math.round(stats.value.averageSimilarity * 100) : 0
)

function getSimilarityColor (score: number): string {
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.6) return 'text-amber-600'
  return 'text-red-500'
}
</script>

<template>
  <div class="space-y-5">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <BarChart2 class="w-4 h-4 text-primary" />
        <span class="text-sm font-medium">检索质量统计</span>
      </div>
      <div class="flex items-center gap-2">
        <Select v-model="days">
          <SelectTrigger class="w-28 h-8 text-xs">
            <SelectValue placeholder="时间范围" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">最近 7 天</SelectItem>
            <SelectItem value="14">最近 14 天</SelectItem>
            <SelectItem value="30">最近 30 天</SelectItem>
            <SelectItem value="90">最近 90 天</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" class="h-8 w-8 p-0" :disabled="isLoading" @click="fetchStats">
          <RefreshCw :class="['w-3.5 h-3.5', isLoading ? 'animate-spin' : '']" />
        </Button>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-if="error" class="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
      <AlertCircle class="w-4 h-4 flex-shrink-0" />
      {{ error }}
    </div>

    <!-- 加载骨架 -->
    <div v-else-if="isLoading && !stats" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div v-for="i in 4" :key="i" class="h-20 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>

    <template v-else-if="stats">
      <!-- 概览指标 -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-muted/50 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-1">
            <Search class="w-3.5 h-3.5 text-primary" />
            <span class="text-xs text-muted-foreground">总检索次数</span>
          </div>
          <p class="text-xl font-bold">{{ stats.totalRetrievals.toLocaleString() }}</p>
        </div>
        <div class="bg-muted/50 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-1">
            <FileText class="w-3.5 h-3.5 text-blue-500" />
            <span class="text-xs text-muted-foreground">引用文档数</span>
          </div>
          <p class="text-xl font-bold">{{ stats.uniqueDocumentsCited }}</p>
        </div>
        <div class="bg-muted/50 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-1">
            <TrendingUp class="w-3.5 h-3.5 text-green-500" />
            <span class="text-xs text-muted-foreground">命中率</span>
          </div>
          <div class="flex items-end gap-1">
            <p class="text-xl font-bold">{{ hitRatePercent }}%</p>
            <div class="mb-0.5 flex-1 bg-muted rounded-full h-1.5">
              <div
                class="h-1.5 rounded-full bg-green-500 transition-all"
                :style="{ width: `${hitRatePercent}%` }"
              />
            </div>
          </div>
        </div>
        <div class="bg-muted/50 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-1">
            <BarChart2 class="w-3.5 h-3.5 text-violet-500" />
            <span class="text-xs text-muted-foreground">平均相似度</span>
          </div>
          <div class="flex items-end gap-1">
            <p class="text-xl font-bold">{{ avgSimilarityPercent }}%</p>
            <div class="mb-0.5 flex-1 bg-muted rounded-full h-1.5">
              <div
                class="h-1.5 rounded-full bg-violet-500 transition-all"
                :style="{ width: `${avgSimilarityPercent}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 热门引用文档 -->
      <div v-if="stats.topDocuments.length > 0" class="space-y-2">
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          热门引用文档 TOP {{ Math.min(stats.topDocuments.length, 10) }}
        </h4>
        <div class="space-y-1.5">
          <div
            v-for="(doc, index) in stats.topDocuments"
            :key="doc.documentId"
            class="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <span class="text-xs font-bold text-muted-foreground w-5 text-right flex-shrink-0">
              {{ index + 1 }}
            </span>
            <FileText class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span class="text-sm flex-1 truncate">{{ doc.documentTitle }}</span>
            <Badge variant="secondary" class="text-xs flex-shrink-0">
              {{ doc.citationCount }} 次
            </Badge>
            <span
              :class="['text-xs font-medium flex-shrink-0', getSimilarityColor(doc.averageSimilarity)]"
            >
              {{ Math.round(doc.averageSimilarity * 100) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- 零引用文档 -->
      <div v-if="stats.zeroCitationDocuments.length > 0" class="space-y-2">
        <div class="flex items-center gap-2">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            未被引用的文档
          </h4>
          <Badge variant="outline" class="text-xs">
            {{ stats.zeroCitationDocuments.length }}
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground">
          这些文档在统计时间范围内从未被 RAG 检索引用，可能需要补充内容或检查向量化状态。
        </p>
        <div class="space-y-1">
          <div
            v-for="doc in stats.zeroCitationDocuments"
            :key="doc.documentId"
            class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <AlertCircle class="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span class="truncate">{{ doc.documentTitle }}</span>
          </div>
        </div>
      </div>

      <!-- 无数据状态 -->
      <div v-if="stats.totalRetrievals === 0" class="text-center py-8">
        <Search class="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
        <p class="text-sm text-muted-foreground">该时间范围内暂无检索记录</p>
        <p class="text-xs text-muted-foreground/70 mt-1">当用户通过 AI 对话使用知识库时，检索日志将自动记录</p>
      </div>
    </template>
  </div>
</template>
