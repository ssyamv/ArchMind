<script setup lang="ts">
/**
 * CommentThread — 评论面板组件
 *
 * 用于在 PRD / 文档 / 原型页面的侧边栏中展示评论列表。
 * 支持添加评论、@提及、标记解决、删除。
 */
import { ref, computed, onMounted, watch } from 'vue'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { useToast } from '~/components/ui/toast/use-toast'
import { useAuthStore } from '~/stores/auth'

interface Comment {
  id: string
  userId: string
  username: string
  avatarUrl?: string
  content: string
  mentions: string[]
  resolved: boolean
  createdAt: string
  updatedAt: string
}

interface Props {
  workspaceId: string
  targetType: 'document' | 'prd' | 'prototype'
  targetId: string
  showResolved?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showResolved: false
})

const emit = defineEmits<{
  commentAdded: [comment: Comment]
}>()

const authStore = useAuthStore()
const { toast } = useToast()

const comments = ref<Comment[]>([])
const newContent = ref('')
const isLoading = ref(false)
const isSubmitting = ref(false)
const showResolved = ref(props.showResolved)

const unresolvedCount = computed(() => comments.value.filter(c => !c.resolved).length)

async function loadComments () {
  isLoading.value = true
  try {
    const data = await $fetch<{ success: boolean; data: Comment[] }>('/api/v1/comments', {
      query: {
        targetType: props.targetType,
        targetId: props.targetId,
        workspaceId: props.workspaceId,
        includeResolved: showResolved.value
      }
    })
    comments.value = data.data
  } catch {
    toast({ title: '加载评论失败', variant: 'destructive' })
  } finally {
    isLoading.value = false
  }
}

async function submitComment () {
  if (!newContent.value.trim()) return
  isSubmitting.value = true
  try {
    // 解析 @提及（格式：@username，需后端做 username→uuid 转换，此处简化为空数组）
    const mentions: string[] = []
    const data = await $fetch<{ success: boolean; data: Comment }>('/api/v1/comments', {
      method: 'POST',
      body: {
        workspaceId: props.workspaceId,
        targetType: props.targetType,
        targetId: props.targetId,
        content: newContent.value.trim(),
        mentions
      }
    })
    comments.value.push(data.data)
    newContent.value = ''
    emit('commentAdded', data.data)
    toast({ title: '评论已添加' })
  } catch {
    toast({ title: '发表评论失败', variant: 'destructive' })
  } finally {
    isSubmitting.value = false
  }
}

async function resolveComment (commentId: string) {
  try {
    await $fetch(`/api/v1/comments/${commentId}/resolve`, { method: 'POST' })
    const comment = comments.value.find(c => c.id === commentId)
    if (comment) comment.resolved = true
    toast({ title: '评论已标记为解决' })
  } catch {
    toast({ title: '操作失败', variant: 'destructive' })
  }
}

async function deleteComment (commentId: string) {
  try {
    await $fetch(`/api/v1/comments/${commentId}`, { method: 'DELETE' })
    comments.value = comments.value.filter(c => c.id !== commentId)
    toast({ title: '评论已删除' })
  } catch {
    toast({ title: '删除失败', variant: 'destructive' })
  }
}

function formatTime (isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} 小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function getInitials (name: string): string {
  return name.slice(0, 2).toUpperCase()
}

watch(() => [props.targetId, props.targetType], loadComments)
onMounted(loadComments)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between px-4 py-3 border-b">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">评论</span>
        <Badge v-if="unresolvedCount > 0" variant="secondary" class="text-xs">
          {{ unresolvedCount }}
        </Badge>
      </div>
      <button
        class="text-xs text-muted-foreground hover:text-foreground transition-colors"
        @click="showResolved = !showResolved; loadComments()"
      >
        {{ showResolved ? '隐藏已解决' : '显示已解决' }}
      </button>
    </div>

    <!-- 评论列表 -->
    <ScrollArea class="flex-1 px-4">
      <div v-if="isLoading" class="py-8 text-center text-sm text-muted-foreground">
        加载中...
      </div>

      <div v-else-if="comments.length === 0" class="py-8 text-center text-sm text-muted-foreground">
        暂无评论
      </div>

      <div v-else class="py-3 space-y-4">
        <div
          v-for="comment in comments"
          :key="comment.id"
          class="group relative"
          :class="{ 'opacity-60': comment.resolved }"
        >
          <div class="flex gap-2.5">
            <!-- 头像 -->
            <Avatar class="h-7 w-7 flex-shrink-0">
              <AvatarImage v-if="comment.avatarUrl" :src="comment.avatarUrl" :alt="comment.username" />
              <AvatarFallback class="text-[10px]">{{ getInitials(comment.username) }}</AvatarFallback>
            </Avatar>

            <div class="flex-1 min-w-0">
              <!-- 作者 + 时间 -->
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-medium">{{ comment.username }}</span>
                <span class="text-[11px] text-muted-foreground">{{ formatTime(comment.createdAt) }}</span>
                <Badge v-if="comment.resolved" variant="outline" class="text-[10px] px-1 py-0 ml-auto">
                  已解决
                </Badge>
              </div>

              <!-- 内容 -->
              <p class="text-sm text-foreground whitespace-pre-wrap break-words">{{ comment.content }}</p>

              <!-- 操作按钮（hover 显示） -->
              <div class="mt-1.5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  v-if="!comment.resolved"
                  class="text-[11px] text-muted-foreground hover:text-emerald-600 transition-colors"
                  @click="resolveComment(comment.id)"
                >
                  标记解决
                </button>
                <button
                  v-if="comment.userId === authStore.user?.id"
                  class="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                  @click="deleteComment(comment.id)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>

          <Separator class="mt-4" />
        </div>
      </div>
    </ScrollArea>

    <!-- 输入框 -->
    <div class="p-4 border-t">
      <Textarea
        v-model="newContent"
        placeholder="添加评论... 支持 @提及"
        class="text-sm min-h-[80px] resize-none mb-2"
        @keydown.ctrl.enter="submitComment"
        @keydown.meta.enter="submitComment"
      />
      <div class="flex justify-between items-center">
        <span class="text-[11px] text-muted-foreground">Ctrl+Enter 发送</span>
        <Button
          size="sm"
          :disabled="!newContent.trim() || isSubmitting"
          @click="submitComment"
        >
          {{ isSubmitting ? '发送中...' : '发送' }}
        </Button>
      </div>
    </div>
  </div>
</template>
