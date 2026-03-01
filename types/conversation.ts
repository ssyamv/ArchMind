/**
 * 对话类型定义
 */

// 对话目标类型
export type ConversationTargetType = 'prd' | 'prototype'

// 目标配置接口
export interface ConversationTarget {
  type: ConversationTargetType
  label: string
  labelEn: string
  icon: string
  description: string
  descriptionEn: string
}

// 可用目标配置
export const CONVERSATION_TARGETS: ConversationTarget[] = [
  {
    type: 'prd',
    label: 'PRD 文档',
    labelEn: 'PRD Document',
    icon: 'FileText',
    description: '生成产品需求文档',
    descriptionEn: 'Generate Product Requirements Document'
  },
  {
    type: 'prototype',
    label: '原型设计',
    labelEn: 'Prototype',
    icon: 'Layout',
    description: '生成或编辑交互原型',
    descriptionEn: 'Generate or edit interactive prototype'
  }
]

// 目标上下文
export interface ConversationTargetContext {
  prototypeHtml?: string
  prototypeSlug?: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  modelUsed?: string
  useRAG?: boolean
  documentIds?: string[]
  documentTitles?: string[]
  timestamp: number
  isStreaming?: boolean
  prdContent?: string
  // 目标特定内容
  targetContent?: string
  targetContentType?: 'markdown' | 'html' | 'json'
}

export interface Conversation {
  id: string
  title?: string
  messages: ConversationMessage[]
  currentPrdContent: string
  // 当前对话目标
  target: ConversationTargetType
  // 目标特定上下文
  targetContext?: ConversationTargetContext
  createdAt: number
  updatedAt: number
  savedToDb?: boolean
  dbId?: string
  /** 上次保存到数据库时的消息数量，用于判断是否有新消息需要保存 */
  lastSavedMessageCount?: number
}

export interface ConversationSaveRequest {
  conversationId: string
  title: string
  messages: ConversationMessage[]
  finalPrdContent: string
}

export interface ConversationSaveResponse {
  success: boolean
  id: string
  message: string
}

// @ 提及的文档
export interface MentionedDocument {
  id: string
  title: string
  fileType: 'pdf' | 'docx' | 'markdown' | 'prd'
  sourceType: 'document' | 'prd'
}
