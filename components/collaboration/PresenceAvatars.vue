<script setup lang="ts">
/**
 * PresenceAvatars — 在线成员头像组件
 *
 * 显示当前工作区在线成员的头像列表，基于 WebSocket Presence 数据。
 * 最多显示 maxVisible 个头像，超出部分显示 +N。
 *
 * 注意：useWebSocket 和 types/websocket 由 feature/46 (#46) 提供，
 * 合并到 develop 后此组件可完整启用，当前仅做类型兼容处理。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { useWebSocket } from '~/composables/useWebSocket'

interface PresenceUser {
  userId: string
  username: string
  avatar?: string
  status: 'online' | 'away' | 'offline'
  lastSeen: number
}

interface Props {
  workspaceId: string
  maxVisible?: number
}

const props = withDefaults(defineProps<Props>(), { maxVisible: 5 })

const presenceMap = ref<Map<string, PresenceUser>>(new Map())

const onlineUsers = computed(() =>
  [...presenceMap.value.values()].filter(u => u.status === 'online')
)
const visibleUsers = computed(() => onlineUsers.value.slice(0, props.maxVisible))
const overflowCount = computed(() => Math.max(0, onlineUsers.value.length - props.maxVisible))

let cleanupFns: (() => void)[] = []

onMounted(async () => {
  try {
    const { joinWorkspace, leaveWorkspace, on } = useWebSocket()

    const offList = on('presence_list', (msg: any) => {
      if (msg.workspaceId !== props.workspaceId) return
      presenceMap.value = new Map(msg.users.map((u: PresenceUser) => [u.userId, u]))
    })

    const offUpdate = on('presence_update', (msg: any) => {
      if (msg.workspaceId !== props.workspaceId) return
      if (msg.user.status === 'offline') {
        presenceMap.value.delete(msg.user.userId)
      } else {
        presenceMap.value.set(msg.user.userId, msg.user)
      }
      presenceMap.value = new Map(presenceMap.value)
    })

    joinWorkspace(props.workspaceId)
    cleanupFns = [
      offList,
      offUpdate,
      () => leaveWorkspace(props.workspaceId)
    ]
  } catch {
    // feature/46 未合并时静默降级
  }
})

onUnmounted(() => {
  for (const fn of cleanupFns) fn()
})

function getInitials (name: string): string {
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <TooltipProvider>
    <div class="flex items-center -space-x-2">
      <Tooltip
        v-for="user in visibleUsers"
        :key="user.userId"
      >
        <TooltipTrigger>
          <div class="relative">
            <Avatar class="h-7 w-7 ring-2 ring-background">
              <AvatarImage v-if="user.avatar" :src="user.avatar" :alt="user.username" />
              <AvatarFallback class="text-[10px]">{{ getInitials(user.username) }}</AvatarFallback>
            </Avatar>
            <!-- 在线绿点 -->
            <span class="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-background" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="text-xs">
          {{ user.username }}
        </TooltipContent>
      </Tooltip>

      <!-- 溢出计数 -->
      <Tooltip v-if="overflowCount > 0">
        <TooltipTrigger>
          <div class="h-7 w-7 rounded-full bg-muted ring-2 ring-background flex items-center justify-center">
            <span class="text-[10px] font-medium text-muted-foreground">+{{ overflowCount }}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="text-xs">
          另有 {{ overflowCount }} 人在线
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
