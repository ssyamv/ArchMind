<script setup lang="ts">
/**
 * ActivityFeed — 工作区活动时间线组件
 *
 * 展示工作区内成员的操作动态，支持无限滚动加载。
 */
import { ref, onMounted } from 'vue'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'

interface ActivityLog {
  id: string
  userId: string
  username: string
  avatarUrl?: string
  action: string
  resourceType?: string
  resourceName?: string
  metadata: Record<string, unknown>
  createdAt: string
}

interface Props {
  workspaceId: string
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), { pageSize: 20 })

const activities = ref<ActivityLog[]>([])
const isLoading = ref(false)
const hasMore = ref(true)
const offset = ref(0)

const ACTION_LABELS: Record<string, string> = {
  uploaded_document: '上传了文档',
  generated_prd: '生成了 PRD',
  added_comment: '添加了评论',
  invited_member: '邀请了成员',
  joined_workspace: '加入了��作区',
  created_prototype: '创建了原型',
  exported_prd: '导出了 PRD',
  deleted_document: '删除了文档'
}

const ACTION_COLORS: Record<string, string> = {
  uploaded_document: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  generated_prd: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  added_comment: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  invited_member: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  joined_workspace: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  created_prototype: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
}

async function loadMore () {
  if (isLoading.value || !hasMore.value) return
  isLoading.value = true
  try {
    const data = await $fetch<{
      success: boolean
      data: ActivityLog[]
      pagination: { total: number }
    }>(`/api/v1/workspaces/${props.workspaceId}/activities`, {
      query: { limit: props.pageSize, offset: offset.value }
    })
    activities.value.push(...data.data)
    offset.value += data.data.length
    hasMore.value = offset.value < data.pagination.total
  } catch {
    // 静默失败，不影响主页面
  } finally {
    isLoading.value = false
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
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function getInitials (name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function getActionLabel (action: string): string {
  return ACTION_LABELS[action] ?? action
}

function getActionColor (action: string): string {
  return ACTION_COLORS[action] ?? 'bg-muted text-muted-foreground'
}

onMounted(loadMore)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 标题 -->
    <div class="px-4 py-3 border-b">
      <span class="text-sm font-medium">工作区动态</span>
    </div>

    <ScrollArea class="flex-1 px-4">
      <div v-if="activities.length === 0 && !isLoading" class="py-8 text-center text-sm text-muted-foreground">
        暂无动态
      </div>

      <div class="py-3 space-y-4">
        <div
          v-for="activity in activities"
          :key="activity.id"
          class="flex gap-3"
        >
          <!-- 头像 -->
          <Avatar class="h-7 w-7 flex-shrink-0 mt-0.5">
            <AvatarImage v-if="activity.avatarUrl" :src="activity.avatarUrl" :alt="activity.username" />
            <AvatarFallback class="text-[10px]">{{ getInitials(activity.username) }}</AvatarFallback>
          </Avatar>

          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span class="text-xs font-medium">{{ activity.username }}</span>
              <Badge
                variant="secondary"
                class="text-[10px] px-1.5 py-0"
                :class="getActionColor(activity.action)"
              >
                {{ getActionLabel(activity.action) }}
              </Badge>
            </div>

            <p v-if="activity.resourceName" class="text-xs text-muted-foreground truncate">
              {{ activity.resourceName }}
            </p>

            <span class="text-[11px] text-muted-foreground">{{ formatTime(activity.createdAt) }}</span>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore" class="py-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            :disabled="isLoading"
            class="text-xs"
            @click="loadMore"
          >
            {{ isLoading ? '加载中...' : '加载更多' }}
          </Button>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
