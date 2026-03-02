/**
 * Webhook 消息格式适配器
 * 将 ArchMind 标准事件负载转换为各平台专属消息格式
 *
 * 支持平台：飞书、钉钉、企业微信、Slack、Discord
 */

import type { WebhookEvent } from './webhook-trigger'

/** ArchMind 标准事件负载 */
export interface StandardPayload {
  event: WebhookEvent
  workspaceId: string
  timestamp: string
  data: Record<string, unknown>
}

/** 事件标签映射 */
const EVENT_LABELS: Record<string, { zh: string; emoji: string }> = {
  'document.uploaded':   { zh: '文档已上传',   emoji: '📄' },
  'document.completed':  { zh: '文档处理完成', emoji: '✅' },
  'document.failed':     { zh: '文档处理失败', emoji: '❌' },
  'prd.generated':       { zh: 'PRD 已生成',   emoji: '📝' },
  'comment.created':     { zh: '新评论',        emoji: '💬' }
}

function getLabel (event: string): { zh: string; emoji: string } {
  return EVENT_LABELS[event] ?? { zh: event, emoji: '🔔' }
}

/** 将事件数据格式化为可读文本（各平台通用） */
function formatDataLines (event: string, data: Record<string, unknown>): string[] {
  const lines: string[] = []
  switch (event) {
    case 'document.uploaded':
    case 'document.completed':
    case 'document.failed':
      if (data.title) lines.push(`文档：${data.title}`)
      if (data.fileType) lines.push(`类型：${String(data.fileType).toUpperCase()}`)
      if (data.error) lines.push(`错误：${data.error}`)
      break
    case 'prd.generated':
      if (data.userInput) lines.push(`需求：${String(data.userInput).slice(0, 80)}${String(data.userInput).length > 80 ? '…' : ''}`)
      break
    case 'comment.created':
      if (data.targetType) lines.push(`对象：${data.targetType}`)
      break
  }
  return lines
}

// ─────────────────────────────────────────────────────────────────────────────
// 飞书（Lark）Interactive Card
// https://open.feishu.cn/document/ukTMukTMukTM/uAjNwUjLwYDM14CM2ATN
// ─────────────────────────────────────────────────────────────────────────────
export function toFeishuPayload (payload: StandardPayload): object {
  const { event, timestamp, data } = payload
  const label = getLabel(event)
  const lines = formatDataLines(event, data)
  const isError = event.includes('failed')

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: `${label.emoji} ${label.zh}` },
        template: isError ? 'red' : 'blue'
      },
      elements: [
        ...(lines.length > 0
          ? [{
              tag: 'div',
              text: { tag: 'lark_md', content: lines.map(l => `**${l.split('：')[0]}**：${l.split('：').slice(1).join('：')}`).join('\n') }
            }]
          : []),
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `${new Date(timestamp).toLocaleString('zh-CN')} · ArchMind` }]
        }
      ]
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 钉钉（DingTalk）Markdown 消息
// https://open.dingtalk.com/document/robots/custom-robot-access
// ─────────────────────────────────────────────────────────────────────────────
export function toDingtalkPayload (payload: StandardPayload): object {
  const { event, timestamp, data } = payload
  const label = getLabel(event)
  const lines = formatDataLines(event, data)
  const isError = event.includes('failed')

  const content = [
    `## ${label.emoji} ${label.zh}`,
    ...lines.map(l => `> ${l}`),
    `> 时间：${new Date(timestamp).toLocaleString('zh-CN')}`
  ].join('\n\n')

  return {
    msgtype: 'markdown',
    markdown: {
      title: `${label.emoji} ${label.zh}`,
      text: content
    },
    ...(isError
      ? { at: { isAtAll: false } }
      : {})
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 企业微信（WeCom）Markdown 消息
// https://developer.work.weixin.qq.com/document/path/91770
// ─────────────────────────────────────────────────────────────────────────────
export function toWecomPayload (payload: StandardPayload): object {
  const { event, timestamp, data } = payload
  const label = getLabel(event)
  const lines = formatDataLines(event, data)
  const isError = event.includes('failed')

  const content = [
    `**${label.emoji} ${label.zh}**`,
    ...lines.map(l => `> <font color="${isError ? 'warning' : 'info'}">${l}</font>`),
    `> 时间：${new Date(timestamp).toLocaleString('zh-CN')}`
  ].join('\n')

  return {
    msgtype: 'markdown',
    markdown: { content }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Slack Block Kit
// https://api.slack.com/block-kit
// ─────────────────────────────────────────────────────────────────────────────
export function toSlackPayload (payload: StandardPayload): object {
  const { event, timestamp, data } = payload
  const label = getLabel(event)
  const lines = formatDataLines(event, data)
  const isError = event.includes('failed')

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${label.emoji} ${label.zh}`, emoji: true }
      },
      ...(lines.length > 0
        ? [{
            type: 'section',
            text: { type: 'mrkdwn', text: lines.map(l => `*${l.split('：')[0]}*: ${l.split('：').slice(1).join('：')}`).join('\n') }
          }]
        : []),
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `${new Date(timestamp).toLocaleString()} · ArchMind${isError ? ' · :red_circle:' : ''}` }
        ]
      }
    ]
  }
}

// ────────────────────────────────────────���────────────────────────────────────
// Discord Embed
// https://discord.com/developers/docs/resources/webhook
// ─────────────────────────────────────────────────────────────────────────────
export function toDiscordPayload (payload: StandardPayload): object {
  const { event, timestamp, data } = payload
  const label = getLabel(event)
  const lines = formatDataLines(event, data)
  const isError = event.includes('failed')

  return {
    embeds: [
      {
        title: `${label.emoji} ${label.zh}`,
        color: isError ? 0xED4245 : 0x5865F2,
        fields: lines.map(l => ({
          name: l.split('：')[0],
          value: l.split('：').slice(1).join('：'),
          inline: true
        })),
        footer: { text: 'ArchMind' },
        timestamp
      }
    ]
  }
}
