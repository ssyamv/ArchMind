<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-2xl flex flex-col max-h-[95vh]" @pointer-down-outside.prevent @interact-outside.prevent>
      <DialogHeader class="shrink-0">
        <DialogTitle>{{ isEdit ? $t('webhook.editTitle') : $t('webhook.createTitle') }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ isEdit ? $t('webhook.editTitle') : $t('webhook.createTitle') }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4 py-2 overflow-y-auto min-h-0 flex-1" @submit.prevent="handleSubmit">
        <!-- 平台类型 -->
        <div class="space-y-2">
          <Label>{{ $t('webhook.type') }}</Label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="wt in WEBHOOK_TYPES"
              :key="wt.value"
              type="button"
              :class="[
                'flex flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors text-xs',
                form.type === wt.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-muted-foreground/50 text-muted-foreground'
              ]"
              @click="form.type = wt.value"
            >
              <span class="w-5 h-5 flex items-center justify-center"><Icon :icon="wt.icon" class="w-full h-full" :style="wt.color ? { color: wt.color } : {}" /></span>
              <span>{{ wt.label }}</span>
            </button>
          </div>
          <!-- 平台说明 -->
          <p class="text-xs text-muted-foreground">
            {{ $t(`webhook.typeHints.${form.type}`) }}
          </p>
        </div>

        <!-- 名称 -->
        <div class="space-y-2">
          <Label for="wh-name">{{ $t('webhook.name') }} <span class="text-destructive">*</span></Label>
          <Input
            id="wh-name"
            v-model="form.name"
            :placeholder="$t('webhook.namePlaceholder')"
            :class="{ 'border-destructive': errors.name }"
          />
          <p v-if="errors.name" class="text-xs text-destructive">{{ errors.name }}</p>
        </div>

        <!-- URL -->
        <div class="space-y-2">
          <Label for="wh-url">{{ $t('webhook.url') }} <span class="text-destructive">*</span></Label>
          <Input
            id="wh-url"
            v-model="form.url"
            :placeholder="currentTypeInfo?.urlHint ?? 'https://'"
            :class="{ 'border-destructive': errors.url }"
          />
          <p v-if="errors.url" class="text-xs text-destructive">{{ errors.url }}</p>
        </div>

        <!-- 订阅事件 -->
        <div class="space-y-2">
          <Label>{{ $t('webhook.events') }} <span class="text-destructive">*</span></Label>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="evt in SUPPORTED_EVENTS"
              :key="evt"
              class="flex items-center gap-2"
            >
              <Checkbox
                :id="`evt-${evt}`"
                :model-value="form.events.includes(evt)"
                @update:model-value="toggleEvent(evt, $event === true)"
              />
              <Label :for="`evt-${evt}`" class="font-normal cursor-pointer text-sm">
                {{ $t(`webhook.eventNames.${evt.replace(/\./g, '_')}`) }}
                <span class="text-xs text-muted-foreground block">{{ evt }}</span>
              </Label>
            </div>
          </div>
          <p v-if="errors.events" class="text-xs text-destructive">{{ errors.events }}</p>
        </div>

        <!-- 状态（仅编辑模式显示） -->
        <div v-if="isEdit" class="flex items-center gap-3">
          <Switch
            :checked="form.active"
            @update:checked="form.active = $event"
          />
          <Label class="font-normal cursor-pointer">
            {{ form.active ? $t('webhook.active') : $t('webhook.inactive') }}
          </Label>
        </div>

        <!-- 密钥展示（仅 standard 类型创建成功后显示） -->
        <div v-if="newSecret" class="rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3 space-y-2">
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">{{ $t('webhook.secretTitle') }}</p>
          <code class="block text-xs break-all bg-yellow-100 dark:bg-yellow-900 rounded p-2 font-mono select-all">{{ newSecret }}</code>
          <p class="text-xs text-yellow-700 dark:text-yellow-300">{{ $t('webhook.secretHint') }}</p>
        </div>
      </form>

      <DialogFooter class="shrink-0">
        <Button variant="outline" :disabled="submitting" @click="$emit('update:open', false)">
          {{ newSecret ? $t('common.close') : $t('common.cancel') }}
        </Button>
        <Button v-if="!newSecret" :disabled="submitting" @click="handleSubmit">
          <Loader2 v-if="submitting" class="w-4 h-4 mr-2 animate-spin" />
          {{ $t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { Icon } from '@iconify/vue'
import { SUPPORTED_EVENTS, WEBHOOK_TYPES, type WebhookType, type Webhook, type CreateWebhookInput, type UpdateWebhookInput } from '~/composables/useWebhooks'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'
import { Switch } from '~/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog'

interface Props {
  open: boolean
  webhook?: Webhook | null
  submitting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  webhook: null,
  submitting: false
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'create': [input: CreateWebhookInput]
  'update': [webhookId: string, input: UpdateWebhookInput]
}>()

const { t } = useI18n()

const isEdit = computed(() => !!props.webhook)
const newSecret = ref<string | null>(null)

const form = ref({
  name: '',
  url: '',
  events: [] as string[],
  active: true,
  type: 'standard' as WebhookType
})

const errors = ref({
  name: '',
  url: '',
  events: ''
})

const currentTypeInfo = computed(() => WEBHOOK_TYPES.find(wt => wt.value === form.value.type))

// 当 webhook prop 变化时（打开编辑模式），填充表单
watch(() => props.webhook, (wh) => {
  if (wh) {
    form.value = {
      name: wh.name,
      url: wh.url,
      events: [...wh.events],
      active: wh.active,
      type: wh.type ?? 'standard'
    }
  } else {
    form.value = { name: '', url: '', events: [], active: true, type: 'standard' }
  }
  errors.value = { name: '', url: '', events: '' }
  newSecret.value = null
})

// Dialog 关闭时重置
watch(() => props.open, (open) => {
  if (!open) {
    newSecret.value = null
    errors.value = { name: '', url: '', events: '' }
  }
})

function toggleEvent (evt: string, checked: boolean) {
  if (checked) {
    if (!form.value.events.includes(evt)) form.value.events.push(evt)
  } else {
    form.value.events = form.value.events.filter(e => e !== evt)
  }
}

function validate (): boolean {
  errors.value = { name: '', url: '', events: '' }
  let valid = true

  if (!form.value.name.trim()) {
    errors.value.name = t('webhook.nameRequired')
    valid = false
  }

  try {
    new URL(form.value.url)
  } catch {
    errors.value.url = t('webhook.urlInvalid')
    valid = false
  }

  if (form.value.events.length === 0) {
    errors.value.events = t('webhook.eventsRequired')
    valid = false
  }

  return valid
}

function handleSubmit () {
  if (!validate()) return

  if (isEdit.value && props.webhook) {
    emit('update', props.webhook.id, {
      name: form.value.name.trim(),
      url: form.value.url.trim(),
      events: form.value.events,
      active: form.value.active,
      type: form.value.type
    })
  } else {
    emit('create', {
      name: form.value.name.trim(),
      url: form.value.url.trim(),
      events: form.value.events,
      type: form.value.type
    })
  }
}

/** 由父组件调用，展示创建成功后的 secret（仅 standard 类型需要） */
function showSecret (secret: string) {
  newSecret.value = secret
}

defineExpose({ showSecret })
</script>
