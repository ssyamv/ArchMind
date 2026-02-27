/**
 * Drizzle ORM Schema 定义
 * PostgreSQL 数据库表结构
 */

import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, decimal, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ============================================
// 工作区表
// ============================================
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  icon: varchar('icon', { length: 10 }).default('📁'),
  color: varchar('color', { length: 20 }).default('#3B82F6'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    isDefaultIdx: index('idx_workspaces_is_default').on(table.isDefault)
  }
})

// ============================================
// 用户表
// ============================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true),
  resetToken: varchar('reset_token', { length: 255 }),
  resetTokenExpires: timestamp('reset_token_expires', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    emailIdx: index('idx_users_email').on(table.email),
    usernameIdx: index('idx_users_username').on(table.username),
    resetTokenIdx: index('idx_users_reset_token').on(table.resetToken)
  }
})

// ============================================
// 文档表
// ============================================
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  filePath: text('file_path').notNull(),
  fileType: varchar('file_type', { length: 20 }).notNull(),
  fileSize: integer('file_size').notNull(),
  content: text('content'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  status: varchar('status', { length: 20 }).default('uploaded'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    userIdIdx: index('idx_documents_user_id').on(table.userId),
    workspaceIdIdx: index('idx_documents_workspace_id').on(table.workspaceId),
    statusIdx: index('idx_documents_status').on(table.status),
    createdAtIdx: index('idx_documents_created_at').on(table.createdAt)
  }
})

// ============================================
// 文档块表（用于向量检索）
// ============================================
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  // embedding: vector('embedding', { dimensions: 1536 }), // pgvector 类型
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    documentIdIdx: index('idx_chunks_document_id').on(table.documentId)
  }
})

// ============================================
// PRD 文档表
// ============================================
export const prdDocuments = pgTable('prd_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  userInput: text('user_input').notNull(),
  modelUsed: varchar('model_used', { length: 100 }).notNull(),
  generationTime: integer('generation_time'),
  tokenCount: integer('token_count'),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 4 }),
  status: varchar('status', { length: 20 }).default('draft'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    userIdIdx: index('idx_prd_user_id').on(table.userId),
    workspaceIdIdx: index('idx_prd_workspace_id').on(table.workspaceId),
    createdAtIdx: index('idx_prd_created_at').on(table.createdAt),
    modelUsedIdx: index('idx_prd_model_used').on(table.modelUsed)
  }
})

// ============================================
// PRD 文档引用表
// ============================================
export const prdDocumentReferences = pgTable('prd_document_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  prdId: uuid('prd_id').references(() => prdDocuments.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  relevanceScore: decimal('relevance_score', { precision: 5, scale: 4 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    prdIdIdx: index('idx_prd_refs_prd_id').on(table.prdId),
    documentIdIdx: index('idx_prd_refs_document_id').on(table.documentId),
    uniquePrdDoc: uniqueIndex('unique_prd_document').on(table.prdId, table.documentId)
  }
})

// ============================================
// 用户 API 配置表（存储第三方模型 API Key）
// ============================================
export const userApiConfigs = pgTable('user_api_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  apiKeyEncrypted: text('api_key_encrypted'),
  baseUrl: varchar('base_url', { length: 500 }),
  models: jsonb('models').default(sql`'[]'::jsonb`), // 用户自定义的模型 ID 列表
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    userIdIdx: index('idx_user_api_configs_user_id').on(table.userId),
    providerIdx: index('idx_user_api_configs_provider').on(table.provider),
    enabledIdx: index('idx_user_api_configs_enabled').on(table.enabled),
    uniqueUserProvider: uniqueIndex('unique_user_provider').on(table.userId, table.provider)
  }
})

// ============================================
// 系统配置表
// ============================================
export const systemConfig = pgTable('system_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
})

// ============================================
// 生成历史表
// ============================================
export const generationHistory = pgTable('generation_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  prdId: uuid('prd_id').references(() => prdDocuments.id, { onDelete: 'set null' }),
  modelUsed: varchar('model_used', { length: 100 }).notNull(),
  userInput: text('user_input').notNull(),
  tokenCount: integer('token_count'),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 4 }),
  generationTime: integer('generation_time'),
  status: varchar('status', { length: 20 }).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    createdAtIdx: index('idx_history_created_at').on(table.createdAt)
  }
})

// ============================================
// 对话表
// ============================================
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  summary: text('summary'),
  messageCount: integer('message_count').default(0),
  prdId: uuid('prd_id').references(() => prdDocuments.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    userIdIdx: index('idx_conversations_user_id').on(table.userId),
    createdAtIdx: index('idx_conversations_created_at').on(table.createdAt)
  }
})

// ============================================
// 对话消息表
// ============================================
export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  modelUsed: varchar('model_used', { length: 100 }),
  useRAG: boolean('use_rag').default(false),
  documentIds: text('document_ids'), // JSON array as string
  prdContent: text('prd_content'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    conversationIdIdx: index('idx_conv_msgs_conversation_id').on(table.conversationId),
    roleIdx: index('idx_conv_msgs_role').on(table.role)
  }
})

// ============================================
// 原型图表
// ============================================
export const prototypes = pgTable('prototypes', {
  id: uuid('id').primaryKey().defaultRandom(),
  prdId: uuid('prd_id').references(() => prdDocuments.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  currentVersion: integer('current_version').default(1),
  status: varchar('status', { length: 20 }).default('draft'),
  deviceType: varchar('device_type', { length: 20 }).default('responsive'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  prdIdIdx: index('idx_prototypes_prd_id').on(table.prdId),
  userIdIdx: index('idx_prototypes_user_id').on(table.userId),
  createdAtIdx: index('idx_prototypes_created_at').on(table.createdAt)
}))

// ============================================
// 原型页面表
// ============================================
export const prototypePages = pgTable('prototype_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  prototypeId: uuid('prototype_id').references(() => prototypes.id, { onDelete: 'cascade' }).notNull(),
  pageName: varchar('page_name', { length: 200 }).notNull(),
  pageSlug: varchar('page_slug', { length: 100 }).notNull(),
  htmlContent: text('html_content').notNull(),
  sortOrder: integer('sort_order').default(0),
  isEntryPage: boolean('is_entry_page').default(false),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  prototypeIdIdx: index('idx_prototype_pages_prototype_id').on(table.prototypeId),
  slugIdx: uniqueIndex('idx_prototype_pages_slug').on(table.prototypeId, table.pageSlug)
}))

// ============================================
// 原型版本表
// ============================================
export const prototypeVersions = pgTable('prototype_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  prototypeId: uuid('prototype_id').references(() => prototypes.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),
  pagesSnapshot: jsonb('pages_snapshot').notNull(),
  commitMessage: text('commit_message'),
  modelUsed: varchar('model_used', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  prototypeIdIdx: index('idx_prototype_versions_prototype_id').on(table.prototypeId),
  versionIdx: uniqueIndex('idx_prototype_versions_number').on(table.prototypeId, table.versionNumber)
}))

// ============================================
// 工作区成员表
// ============================================
export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).default('member').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  workspaceIdIdx: index('idx_workspace_members_workspace').on(table.workspaceId),
  userIdIdx: index('idx_workspace_members_user').on(table.userId),
  uniqueMember: uniqueIndex('unique_workspace_member').on(table.workspaceId, table.userId)
}))

// ============================================
// 工作区邀请表
// ============================================
export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  inviterId: uuid('inviter_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).default('member').notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  tokenIdx: uniqueIndex('idx_workspace_invitations_token').on(table.token),
  workspaceIdIdx: index('idx_workspace_invitations_workspace').on(table.workspaceId)
}))

// ============================================
// 资源表
// ============================================
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // 基本信息
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),

  // 文件信息
  fileName: varchar('file_name', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  fileSize: integer('file_size').notNull(),

  // 存储信息
  storageProvider: varchar('storage_provider', { length: 50 }).default('huawei-obs'),
  storageBucket: varchar('storage_bucket', { length: 200 }),
  storageKey: varchar('storage_key', { length: 1000 }).notNull(),
  contentHash: varchar('content_hash', { length: 64 }),

  // 资源来源
  source: varchar('source', { length: 20 }).notNull(),

  // AI 生成相关
  generationPrompt: text('generation_prompt'),
  modelUsed: varchar('model_used', { length: 100 }),

  // 元数据
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // 时间戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  userIdIdx: index('idx_assets_user_id').on(table.userId),
  sourceIdx: index('idx_assets_source').on(table.source),
  createdAtIdx: index('idx_assets_created_at').on(table.createdAt),
  hashIdx: index('idx_assets_content_hash').on(table.contentHash)
}))

// ============================================
// PRD-资源关联表
// ============================================
export const prdAssets = pgTable('prd_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  prdId: uuid('prd_id').references(() => prdDocuments.id, { onDelete: 'cascade' }).notNull(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),

  // 关联元数据
  addedBy: varchar('added_by', { length: 20 }).default('manual'),
  sortOrder: integer('sort_order').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  prdIdIdx: index('idx_prd_assets_prd_id').on(table.prdId),
  assetIdIdx: index('idx_prd_assets_asset_id').on(table.assetId),
  uniquePrdAsset: uniqueIndex('unique_prd_asset').on(table.prdId, table.assetId)
}))

// ============================================
// 评论表（团队协作）
// ============================================
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(), // 'document' | 'prd' | 'prototype'
  targetId: uuid('target_id').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  mentions: jsonb('mentions').default(sql`'[]'::jsonb`), // 被 @提及的用户 ID 数组
  resolved: boolean('resolved').default(false).notNull(),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  workspaceIdx: index('idx_comments_workspace').on(table.workspaceId),
  targetIdx: index('idx_comments_target').on(table.targetType, table.targetId),
  userIdx: index('idx_comments_user').on(table.userId),
  resolvedIdx: index('idx_comments_resolved').on(table.resolved),
  createdAtIdx: index('idx_comments_created_at').on(table.createdAt)
}))

// ============================================
// 活动日志表（工作区动态流，面向用户展示）
// ============================================
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // e.g. 'uploaded_document', 'generated_prd'
  resourceType: varchar('resource_type', { length: 20 }),
  resourceId: uuid('resource_id'),
  resourceName: varchar('resource_name', { length: 500 }),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  workspaceIdx: index('idx_activity_logs_workspace').on(table.workspaceId),
  userIdx: index('idx_activity_logs_user').on(table.userId),
  createdAtIdx: index('idx_activity_logs_created_at').on(table.createdAt),
  actionIdx: index('idx_activity_logs_action').on(table.action)
}))
