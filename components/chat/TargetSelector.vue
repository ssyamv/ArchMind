<template>
  <Select
    :model-value="modelValue"
    :disabled="isLoading"
    @update:model-value="handleSelect"
  >
    <SelectTrigger class="h-8 w-auto min-w-[100px] text-xs border-0 shadow-none hover:bg-background/80 bg-transparent">
      <SelectValue :placeholder="$t('chat.selectTarget')" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="target in targets"
        :key="target.type"
        :value="target.type"
      >
        <div class="flex items-center gap-2">
          <component :is="getIcon(target.icon)" class="w-3.5 h-3.5" />
          <span>{{ locale === 'zh-CN' || locale === 'zh' ? target.label : target.labelEn }}</span>
        </div>
      </SelectItem>
    </SelectContent>
  </Select>
</template>

<script setup lang="ts">
import { FileText, Layout } from 'lucide-vue-next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select'
import type { ConversationTargetType } from '~/types/conversation'
import { CONVERSATION_TARGETS } from '~/types/conversation'

const props = defineProps<{
  modelValue: ConversationTargetType
  isLoading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [target: ConversationTargetType]
}>()

const { locale } = useI18n()

const targets = CONVERSATION_TARGETS

function getIcon (iconName: string) {
  const icons: Record<string, any> = {
    FileText,
    Layout
  }
  return icons[iconName] || FileText
}

function handleSelect (value: unknown) {
  emit('update:modelValue', value as ConversationTargetType)
}
</script>
