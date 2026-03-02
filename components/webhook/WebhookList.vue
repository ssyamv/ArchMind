<template>
  <div class="space-y-4">
    <!-- 头部 -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold">{{ $t('webhook.title') }}</h3>
        <p class="text-sm text-muted-foreground">{{ $t('webhook.description') }}</p>
      </div>
      <Button @click="$emit('create')">
        <Plus class="w-4 h-4 mr-2" />
        {{ $t('webhook.add') }}
      </Button>
    </div>

    <!-- 加载骨架屏 -->
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-3 rounded-md border border-border">
        <Skeleton class="h-4 w-48" />
        <Skeleton class="h-5 w-16 rounded-full" />
        <Skeleton class="h-5 w-12 rounded-full" />
        <Skeleton class="h-6 w-6 ml-auto rounded" />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="webhooks.length === 0" class="text-center py-10 border border-dashed border-border rounded-md">
      <Webhook class="w-10 h-10 mx-auto text-muted-foreground mb-3" />
      <p class="text-sm font-medium">{{ $t('webhook.noWebhooks') }}</p>
      <p class="text-xs text-muted-foreground mt-1">{{ $t('webhook.noWebhooksHint') }}</p>
    </div>

    <!-- 列表 -->
    <div v-else class="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t('webhook.name') }}</TableHead>
            <TableHead>{{ $t('webhook.events') }}</TableHead>
            <TableHead>{{ $t('webhook.status') }}</TableHead>
            <TableHead class="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="wh in webhooks" :key="wh.id">
            <TableCell>
              <div>
                <p class="font-medium text-sm">{{ wh.name }}</p>
                <p class="text-xs text-muted-foreground truncate max-w-[260px]">{{ wh.url }}</p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" class="text-xs">
                {{ $t('webhook.eventsCount', { n: wh.events.length }) }}
              </Badge>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-1.5">
                <span
                  class="inline-block w-2 h-2 rounded-full"
                  :class="wh.active ? 'bg-green-500' : 'bg-muted-foreground'"
                />
                <span class="text-sm">
                  {{ wh.active ? $t('webhook.active') : $t('webhook.inactive') }}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <MoreHorizontal class="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem class="cursor-pointer" @click="$emit('view-deliveries', wh)">
                    <History class="w-4 h-4 mr-2" />
                    {{ $t('webhook.deliveries') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem class="cursor-pointer" @click="$emit('edit', wh)">
                    <Pencil class="w-4 h-4 mr-2" />
                    {{ $t('common.edit') }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="cursor-pointer text-destructive focus:text-destructive"
                    @click="$emit('delete', wh)"
                  >
                    <Trash2 class="w-4 h-4 mr-2" />
                    {{ $t('common.delete') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, MoreHorizontal, Pencil, Trash2, History, Webhook } from 'lucide-vue-next'
import { type Webhook as WebhookType } from '~/composables/useWebhooks'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '~/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'

interface Props {
  webhooks: WebhookType[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), { loading: false })

defineEmits<{
  create: []
  edit: [webhook: WebhookType]
  delete: [webhook: WebhookType]
  'view-deliveries': [webhook: WebhookType]
}>()
</script>
