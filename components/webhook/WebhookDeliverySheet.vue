<template>
  <Sheet :open="open" @update:open="$emit('update:open', $event)">
    <SheetContent class="w-full sm:max-w-2xl overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{{ $t('webhook.deliveriesTitle', { name: webhook?.name ?? '' }) }}</SheetTitle>
        <SheetDescription class="truncate text-xs">{{ webhook?.url }}</SheetDescription>
      </SheetHeader>

      <div class="mt-4 space-y-2">
        <!-- 加载状态 -->
        <div v-if="loading" class="flex justify-center py-8">
          <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
        </div>

        <!-- 空状态 -->
        <div v-else-if="deliveries.length === 0" class="text-center py-10 text-muted-foreground">
          <p>{{ $t('webhook.noDeliveries') }}</p>
        </div>

        <!-- 投递记录列表 -->
        <template v-else>
          <div
            v-for="delivery in deliveries"
            :key="delivery.id"
            class="rounded-md border border-border overflow-hidden"
          >
            <!-- 行头部（可点击展开） -->
            <button
              type="button"
              class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              @click="toggleExpand(delivery.id)"
            >
              <!-- 状态图标 -->
              <span
                :class="delivery.success
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-destructive'"
                class="shrink-0"
              >
                <CheckCircle2 v-if="delivery.success" class="w-4 h-4" />
                <XCircle v-else class="w-4 h-4" />
              </span>

              <!-- 事件 + 时间 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <Badge variant="outline" class="text-xs font-mono">{{ delivery.event }}</Badge>
                  <span v-if="delivery.statusCode" class="text-xs text-muted-foreground">
                    {{ delivery.statusCode }}
                  </span>
                  <span v-if="delivery.durationMs" class="text-xs text-muted-foreground">
                    {{ formatDuration(delivery.durationMs) }}
                  </span>
                </div>
                <p class="text-xs text-muted-foreground mt-0.5">{{ formatDate(delivery.createdAt) }}</p>
              </div>

              <!-- 重新投递 + 展开箭头 -->
              <div class="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2 text-xs"
                  :disabled="redelivering === delivery.id"
                  @click.stop="handleRedeliver(delivery)"
                >
                  <Loader2 v-if="redelivering === delivery.id" class="w-3 h-3 mr-1 animate-spin" />
                  <RefreshCw v-else class="w-3 h-3 mr-1" />
                  {{ $t('webhook.redeliver') }}
                </Button>
                <ChevronDown
                  class="w-4 h-4 text-muted-foreground transition-transform"
                  :class="{ 'rotate-180': expandedIds.has(delivery.id) }"
                />
              </div>
            </button>

            <!-- 展开内容 -->
            <div v-if="expandedIds.has(delivery.id)" class="border-t border-border bg-muted/20">
              <!-- 错误信息 -->
              <div v-if="delivery.error" class="px-3 py-2 text-xs text-destructive bg-destructive/5 border-b border-border">
                <span class="font-medium">{{ $t('webhook.error') }}：</span>{{ delivery.error }}
              </div>

              <!-- 请求 payload -->
              <div class="px-3 py-2 space-y-1">
                <p class="text-xs font-medium text-muted-foreground">{{ $t('webhook.payload') }}</p>
                <pre class="text-xs bg-background rounded border border-border p-2 overflow-x-auto max-h-40 scrollbar-thin">{{ formatJson(delivery.payload) }}</pre>
              </div>

              <!-- 响应 body -->
              <div v-if="delivery.responseBody" class="px-3 py-2 space-y-1 border-t border-border">
                <p class="text-xs font-medium text-muted-foreground">{{ $t('webhook.response') }}</p>
                <pre class="text-xs bg-background rounded border border-border p-2 overflow-x-auto max-h-40 scrollbar-thin">{{ tryFormatJson(delivery.responseBody) }}</pre>
              </div>
            </div>
          </div>

          <!-- 加载更多 -->
          <div v-if="hasMore" class="flex justify-center pt-2">
            <Button variant="outline" size="sm" :disabled="loadingMore" @click="loadMore">
              <Loader2 v-if="loadingMore" class="w-4 h-4 mr-2 animate-spin" />
              {{ $t('common.loadMore') }}
            </Button>
          </div>
        </template>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2, CheckCircle2, XCircle, RefreshCw, ChevronDown } from 'lucide-vue-next'
import { useWebhooks, type Webhook, type WebhookDelivery } from '~/composables/useWebhooks'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { useToast } from '~/components/ui/toast/use-toast'

interface Props {
  open: boolean
  webhook: Webhook | null
  workspaceId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t } = useI18n()
const { toast } = useToast()
const { fetchDeliveries, redeliver } = useWebhooks(props.workspaceId)

const deliveries = ref<WebhookDelivery[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const total = ref(0)
const expandedIds = ref(new Set<string>())
const redelivering = ref<string | null>(null)

const PAGE_SIZE = 20

const hasMore = computed(() => deliveries.value.length < total.value)

watch(() => props.open, async (open) => {
  if (open && props.webhook) {
    deliveries.value = []
    expandedIds.value = new Set()
    await loadDeliveries()
  }
})

async function loadDeliveries () {
  if (!props.webhook) return
  loading.value = true
  try {
    const result = await fetchDeliveries(props.webhook.id, { limit: PAGE_SIZE, offset: 0 })
    deliveries.value = result.data
    total.value = result.total
  } catch {
    toast({ title: t('webhook.deliveriesLoadError'), variant: 'destructive' })
  } finally {
    loading.value = false
  }
}

async function loadMore () {
  if (!props.webhook) return
  loadingMore.value = true
  try {
    const result = await fetchDeliveries(props.webhook.id, {
      limit: PAGE_SIZE,
      offset: deliveries.value.length
    })
    deliveries.value.push(...result.data)
    total.value = result.total
  } catch {
    toast({ title: t('webhook.deliveriesLoadError'), variant: 'destructive' })
  } finally {
    loadingMore.value = false
  }
}

function toggleExpand (id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  // 触发响应式更新
  expandedIds.value = new Set(expandedIds.value)
}

async function handleRedeliver (delivery: WebhookDelivery) {
  if (!props.webhook) return
  redelivering.value = delivery.id
  try {
    const result = await redeliver(props.webhook.id, delivery.id)
    if (result.success) {
      toast({ title: t('webhook.redeliverSuccess') })
    } else {
      toast({ title: t('webhook.redeliverFailed'), variant: 'destructive' })
    }
    // 刷新列表
    await loadDeliveries()
  } catch {
    toast({ title: t('webhook.redeliverError'), variant: 'destructive' })
  } finally {
    redelivering.value = null
  }
}

function formatDate (dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDuration (ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function formatJson (value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function tryFormatJson (str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
</script>
