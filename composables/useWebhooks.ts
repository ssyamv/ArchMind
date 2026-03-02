/**
 * Webhook 管理 Composable
 * 封装工作区 Webhook 的 CRUD 操作和投递历史查询
 */

import { ref } from 'vue'

export type WebhookType = 'standard' | 'feishu' | 'dingtalk' | 'wecom' | 'slack' | 'discord'

// Iconify 图标名 + 品牌色，通过 @iconify/vue 的 Icon 组件在线按需加载
// logos:* 图标集自带品牌色（color 为 null），其余单色图标需指定 color
export const WEBHOOK_TYPES: { value: WebhookType; label: string; icon: string; color: string | null; urlHint: string }[] = [
  { value: 'standard', label: 'Standard HTTP', icon: 'lucide:link',           color: null,      urlHint: 'https://your-server.com/webhook' },
  { value: 'feishu',   label: '飞书',          icon: 'icon-park:lark',        color: '#3370FF', urlHint: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
  { value: 'dingtalk', label: '钉钉',          icon: 'ant-design:dingtalk',   color: '#1677FF', urlHint: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
  { value: 'wecom',    label: '企业微信',      icon: 'tdesign:logo-wecom',    color: '#07C160', urlHint: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' },
  { value: 'slack',    label: 'Slack',         icon: 'logos:slack-icon',      color: null,      urlHint: 'https://hooks.slack.com/services/...' },
  { value: 'discord',  label: 'Discord',       icon: 'logos:discord-icon',    color: null,      urlHint: 'https://discord.com/api/webhooks/...' }
]

export interface Webhook {
  id: string
  workspaceId: string
  userId: string
  name: string
  url: string
  events: string[]
  active: boolean
  headers: Record<string, string>
  type: WebhookType
  createdAt: string
  updatedAt: string
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: string
  payload: Record<string, unknown>
  statusCode: number | null
  responseBody: string | null
  durationMs: number | null
  success: boolean
  error: string | null
  createdAt: string
}

export interface CreateWebhookInput {
  name: string
  url: string
  events: string[]
  headers?: Record<string, string>
  type?: WebhookType
}

export interface UpdateWebhookInput {
  name?: string
  url?: string
  events?: string[]
  active?: boolean
  headers?: Record<string, string>
  type?: WebhookType
}

export const SUPPORTED_EVENTS = [
  'document.uploaded',
  'document.completed',
  'document.failed',
  'prd.generated',
  'comment.created'
] as const

export function useWebhooks (workspaceId: string) {
  const webhooks = ref<Webhook[]>([])
  const loading = ref(false)
  const submitting = ref(false)

  async function fetchWebhooks () {
    loading.value = true
    try {
      const response = await $fetch<{ success: boolean; data: Webhook[] }>(
        `/api/v1/workspaces/${workspaceId}/webhooks`
      )
      webhooks.value = response.data
    } finally {
      loading.value = false
    }
  }

  async function createWebhook (input: CreateWebhookInput): Promise<{ webhook: Webhook; secret: string }> {
    submitting.value = true
    try {
      const response = await $fetch<{ success: boolean; data: Webhook & { secret: string } }>(
        `/api/v1/workspaces/${workspaceId}/webhooks`,
        { method: 'POST', body: input }
      )
      const { secret, ...webhook } = response.data
      webhooks.value.unshift(webhook)
      return { webhook, secret }
    } finally {
      submitting.value = false
    }
  }

  async function updateWebhook (webhookId: string, input: UpdateWebhookInput): Promise<Webhook> {
    submitting.value = true
    try {
      const response = await $fetch<{ success: boolean; data: Webhook }>(
        `/api/v1/workspaces/${workspaceId}/webhooks/${webhookId}`,
        { method: 'PATCH', body: input }
      )
      const updated = response.data
      const idx = webhooks.value.findIndex(w => w.id === webhookId)
      if (idx >= 0) webhooks.value[idx] = updated
      return updated
    } finally {
      submitting.value = false
    }
  }

  async function deleteWebhook (webhookId: string): Promise<void> {
    await $fetch(`/api/v1/workspaces/${workspaceId}/webhooks/${webhookId}`, { method: 'DELETE' })
    webhooks.value = webhooks.value.filter(w => w.id !== webhookId)
  }

  async function fetchDeliveries (
    webhookId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ data: WebhookDelivery[]; total: number }> {
    const query = new URLSearchParams()
    if (options?.limit) query.set('limit', String(options.limit))
    if (options?.offset) query.set('offset', String(options.offset))
    const qs = query.toString() ? `?${query}` : ''

    const response = await $fetch<{
      success: boolean
      data: WebhookDelivery[]
      pagination: { total: number; limit: number; offset: number }
    }>(`/api/v1/workspaces/${workspaceId}/webhooks/${webhookId}/deliveries${qs}`)

    return { data: response.data, total: response.pagination.total }
  }

  async function redeliver (webhookId: string, deliveryId: string): Promise<{ success: boolean }> {
    const response = await $fetch<{ success: boolean; data: { success: boolean } }>(
      `/api/v1/workspaces/${workspaceId}/webhooks/${webhookId}/deliveries/${deliveryId}/redeliver`,
      { method: 'POST' }
    )
    return { success: response.data.success }
  }

  return {
    webhooks,
    loading,
    submitting,
    fetchWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    fetchDeliveries,
    redeliver
  }
}
