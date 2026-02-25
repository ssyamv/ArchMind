<template>
  <Card
    :class="[
      'group hover:shadow-lg transition-all duration-300 cursor-pointer',
      viewMode === 'grid' ? 'hover:-translate-y-1' : ''
    ]"
    @click="$emit('edit', project.id)"
  >
    <CardHeader>
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <!-- Project Icon -->
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText class="w-5 h-5 text-primary" />
          </div>

          <!-- Project Info -->
          <div class="flex-1 min-w-0">
            <CardTitle class="text-base mb-1 truncate">
              {{ project.name }}
            </CardTitle>
            <div class="flex items-center gap-2">
              <Badge :variant="getStatusVariant(project.status)" class="text-xs">
                {{ getStatusLabel(project.status) }}
              </Badge>
              <!-- 显示"进行中"标记 -->
              <Badge v-if="!project.hasPrdContent" variant="outline" class="text-xs text-muted-foreground">
                {{ $t('common.inProgress') }}
              </Badge>
            </div>
          </div>
        </div>

        <!-- Actions Dropdown -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child @click.stop>
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
              <MoreVertical class="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click.stop="$emit('edit', project.id)">
              <Pencil class="w-4 h-4 mr-2" />
              {{ $t('common.edit') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click.stop="handleDuplicate">
              <Copy class="w-4 h-4 mr-2" />
              {{ $t('common.duplicate') }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-destructive focus:text-destructive"
              @click.stop="$emit('delete', project.id)"
            >
              <Trash2 class="w-4 h-4 mr-2" />
              {{ $t('common.delete') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardHeader>

    <CardContent>
      <!-- Logic Coverage Progress -->
      <div class="space-y-2 mb-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">{{ $t('projects.logicCoverage') }}</span>
          <span class="font-medium">{{ project.logicCoverage }}%</span>
        </div>
        <Progress :model-value="project.logicCoverage" class="h-2" />
      </div>

      <!-- Description (if available) -->
      <p
        v-if="project.description"
        class="text-sm text-muted-foreground line-clamp-2 mb-3"
      >
        {{ project.description }}
      </p>

      <!-- Last Edited -->
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock class="w-3 h-3" />
        <span>{{ $t('common.lastEdited') }} {{ project.lastEdited }}</span>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FileText, MoreVertical, Pencil, Copy, Trash2, Clock } from 'lucide-vue-next'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'
import { Progress } from '~/components/ui/progress'
import { useToast } from '~/components/ui/toast/use-toast'

interface Project {
  id: string
  name: string
  status: 'drafting' | 'reviewing' | 'archived'
  logicCoverage: number
  lastEdited: string
  description?: string
  hasPrdContent?: boolean // 是否已生成 PRD 内容
}

const { t } = useI18n()
const { toast } = useToast()
const isDuplicating = ref(false)

const props = defineProps<{
  project: Project
  viewMode: 'grid' | 'list'
}>()

const emit = defineEmits<{
  edit: [id: string]
  delete: [id: string]
  duplicate: [newId: string]
}>()

function getStatusVariant(status: Project['status']): 'default' | 'secondary' | 'outline' {
  const variants: Record<Project['status'], 'default' | 'secondary' | 'outline'> = {
    drafting: 'default',
    reviewing: 'secondary',
    archived: 'outline'
  }
  return variants[status]
}

function getStatusLabel(status: Project['status']) {
  const statusKeys: Record<Project['status'], string> = {
    drafting: 'projects.status.drafting',
    reviewing: 'projects.status.reviewing',
    archived: 'projects.status.archived'
  }
  return t(statusKeys[status])
}

async function handleDuplicate() {
  if (isDuplicating.value) return
  isDuplicating.value = true
  try {
    const result = await $fetch<{ success: boolean; data: { id: string } }>(
      `/api/v1/prd/${props.project.id}/duplicate`,
      { method: 'POST' }
    )
    toast({ title: t('projects.duplicateSuccess'), variant: 'success' })
    emit('duplicate', result.data.id)
  } catch (err: any) {
    toast({ title: t('projects.duplicateFailed'), variant: 'destructive' })
  } finally {
    isDuplicating.value = false
  }
}
</script>
