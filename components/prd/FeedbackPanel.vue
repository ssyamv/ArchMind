<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Star } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Textarea } from '~/components/ui/textarea'
import { useToast } from '~/components/ui/toast/use-toast'

interface Props {
  prdId: string
}

const props = defineProps<Props>()

// ─── 标签常量 ────────────────────────────────────────────────────────────────

const POSITIVE_TAGS = ['结构清晰', 'KPI 具体', '行业符合', '可直接使用']
const NEGATIVE_TAGS = ['内容空泛', '缺少数据支撑', '技术方案不实际', '需要大量修改']

// ─── 状态机 ──────────────────────────────────────────────────────────────────

type FeedbackState = 'idle' | 'unrated' | 'selecting' | 'submitting' | 'rated'

const state = ref<FeedbackState>('idle')
const hoverRating = ref(0)
const selectedRating = ref(0)
const selectedPositives = ref<string[]>([])
const selectedNegatives = ref<string[]>([])
const comment = ref('')

// 已提交的反馈（用于 rated 状态展示）
const submittedFeedback = ref<{
  rating: number
  positives: string[]
  negatives: string[]
  comment: string | null
  updatedAt: string
} | null>(null)

const { toast } = useToast()

// ─── 加载已有反馈 ─────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const res = await $fetch<{ success: boolean; data: any }>(`/api/v1/prd/${props.prdId}/feedback`)
    if (res.success && res.data) {
      submittedFeedback.value = res.data
      selectedRating.value = res.data.rating
      selectedPositives.value = res.data.positives ?? []
      selectedNegatives.value = res.data.negatives ?? []
      comment.value = res.data.comment ?? ''
      state.value = 'rated'
    } else {
      state.value = 'unrated'
    }
  } catch {
    state.value = 'unrated'
  }
})

// ─── 星级交互 ─────────────────────────────────────────────────────────────────

function handleStarHover (rating: number) {
  if (state.value === 'rated') return
  hoverRating.value = rating
}

function handleStarLeave () {
  hoverRating.value = 0
}

function handleStarClick (rating: number) {
  if (state.value === 'submitting') return
  selectedRating.value = rating
  state.value = 'selecting'
}

function getStarFill (index: number): boolean {
  const activeRating = hoverRating.value || selectedRating.value
  return index <= activeRating
}

// ─── 标签切换 ─────────────────────────────────────────────────────────────────

function togglePositive (tag: string) {
  const idx = selectedPositives.value.indexOf(tag)
  if (idx === -1) {
    selectedPositives.value.push(tag)
  } else {
    selectedPositives.value.splice(idx, 1)
  }
}

function toggleNegative (tag: string) {
  const idx = selectedNegatives.value.indexOf(tag)
  if (idx === -1) {
    selectedNegatives.value.push(tag)
  } else {
    selectedNegatives.value.splice(idx, 1)
  }
}

// ─── 提交 ─────────────────────────────────────────────────────────────────────

async function handleSubmit () {
  if (!selectedRating.value || state.value === 'submitting') return

  state.value = 'submitting'
  try {
    const res = await $fetch<{ success: boolean; data: any }>(`/api/v1/prd/${props.prdId}/feedback`, {
      method: 'POST',
      body: {
        rating: selectedRating.value,
        positives: selectedPositives.value,
        negatives: selectedNegatives.value,
        comment: comment.value || undefined
      }
    })

    if (res.success) {
      submittedFeedback.value = res.data
      state.value = 'rated'
      toast({ title: '感谢您的反馈！', description: '您的评价已提交成功。' })
    }
  } catch (err: any) {
    state.value = 'selecting'
    toast({
      title: '提交失败',
      description: err?.data?.message ?? '请稍后重试',
      variant: 'destructive'
    })
  }
}

// ─── 重新编辑 ─────────────────────────────────────────────────────────────────

function handleEdit () {
  state.value = 'selecting'
}

// ─── 评分文字 ─────────────────────────────────────────────────────────────────

const RATING_LABELS: Record<number, string> = {
  1: '很不满意',
  2: '不满意',
  3: '一般',
  4: '满意',
  5: '非常满意'
}

function getRatingLabel (rating: number): string {
  return RATING_LABELS[rating] ?? ''
}
</script>

<template>
  <div class="border border-border rounded-xl p-5 bg-card mt-6">
    <!-- 标题 -->
    <div class="flex items-center gap-2 mb-4">
      <Star class="w-4 h-4 text-amber-500" />
      <h3 class="text-sm font-semibold text-foreground">
        PRD 质量反馈
      </h3>
    </div>

    <!-- 加载中 -->
    <div v-if="state === 'idle'" class="text-sm text-muted-foreground animate-pulse">
      加载中...
    </div>

    <!-- 已评分展示 -->
    <div v-else-if="state === 'rated'" class="space-y-3">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-0.5">
          <Star
            v-for="i in 5"
            :key="i"
            :class="[
              'w-5 h-5',
              i <= (submittedFeedback?.rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'
            ]"
          />
        </div>
        <span class="text-sm font-medium text-foreground">
          {{ getRatingLabel(submittedFeedback?.rating ?? 0) }}
        </span>
        <span class="text-xs text-muted-foreground ml-auto">
          已提交
        </span>
      </div>

      <!-- 标签展示 -->
      <div v-if="(submittedFeedback?.positives?.length ?? 0) > 0" class="flex flex-wrap gap-1.5">
        <Badge
          v-for="tag in submittedFeedback!.positives"
          :key="tag"
          variant="secondary"
          class="text-xs bg-green-100 text-green-700 border-0"
        >
          👍 {{ tag }}
        </Badge>
      </div>
      <div v-if="(submittedFeedback?.negatives?.length ?? 0) > 0" class="flex flex-wrap gap-1.5">
        <Badge
          v-for="tag in submittedFeedback!.negatives"
          :key="tag"
          variant="secondary"
          class="text-xs bg-red-100 text-red-700 border-0"
        >
          👎 {{ tag }}
        </Badge>
      </div>
      <p v-if="submittedFeedback?.comment" class="text-xs text-muted-foreground italic">
        "{{ submittedFeedback.comment }}"
      </p>

      <Button variant="ghost" size="sm" class="text-xs h-7" @click="handleEdit">
        修改评价
      </Button>
    </div>

    <!-- 未评分 / 选择中 / 提交中 -->
    <div v-else class="space-y-4">
      <!-- 星级选择 -->
      <div class="space-y-1.5">
        <p class="text-sm text-muted-foreground">
          这份 PRD 对您的帮助程度如何？
        </p>
        <div
          class="flex items-center gap-1"
          @mouseleave="handleStarLeave"
        >
          <button
            v-for="i in 5"
            :key="i"
            type="button"
            class="focus:outline-none transition-transform hover:scale-110"
            @mouseenter="handleStarHover(i)"
            @click="handleStarClick(i)"
          >
            <Star
              :class="[
                'w-7 h-7 transition-colors',
                getStarFill(i) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'
              ]"
            />
          </button>
          <span
            v-if="hoverRating || selectedRating"
            class="ml-2 text-sm text-muted-foreground"
          >
            {{ getRatingLabel(hoverRating || selectedRating) }}
          </span>
        </div>
      </div>

      <!-- 标签选择（点击星级后展开） -->
      <template v-if="state === 'selecting' || state === 'submitting'">
        <!-- 好的方面 -->
        <div class="space-y-2">
          <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            做得好的地方
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in POSITIVE_TAGS"
              :key="tag"
              type="button"
              :class="[
                'px-2.5 py-1 text-xs rounded-full border transition-colors',
                selectedPositives.includes(tag)
                  ? 'bg-green-100 border-green-300 text-green-700'
                  : 'border-border text-muted-foreground hover:border-green-300 hover:text-green-700'
              ]"
              @click="togglePositive(tag)"
            >
              {{ selectedPositives.includes(tag) ? '✓ ' : '' }}{{ tag }}
            </button>
          </div>
        </div>

        <!-- 需改进的地方 -->
        <div class="space-y-2">
          <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            需要改进的地方
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in NEGATIVE_TAGS"
              :key="tag"
              type="button"
              :class="[
                'px-2.5 py-1 text-xs rounded-full border transition-colors',
                selectedNegatives.includes(tag)
                  ? 'bg-red-100 border-red-300 text-red-700'
                  : 'border-border text-muted-foreground hover:border-red-300 hover:text-red-700'
              ]"
              @click="toggleNegative(tag)"
            >
              {{ selectedNegatives.includes(tag) ? '✓ ' : '' }}{{ tag }}
            </button>
          </div>
        </div>

        <!-- 补充说明 -->
        <Textarea
          v-model="comment"
          placeholder="有什么想对我们说的？（可选，最多 500 字）"
          class="text-sm resize-none"
          :maxlength="500"
          rows="2"
        />

        <!-- 提交按钮 -->
        <div class="flex justify-end">
          <Button
            size="sm"
            :disabled="!selectedRating || state === 'submitting'"
            @click="handleSubmit"
          >
            <span v-if="state === 'submitting'" class="flex items-center gap-1.5">
              <span class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              提交中...
            </span>
            <span v-else>提交反馈</span>
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
