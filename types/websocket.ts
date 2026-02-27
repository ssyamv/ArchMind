/**
 * WebSocket 消息类型系统
 *
 * 定义客户端与服务端之间所有 WebSocket 消息的结构。
 * 所有消息均为 JSON 格式，通过 type 字段区分。
 */

// ─── 基础结构 ────────────────────────────────────────────────────────────────

/** 所有 WebSocket 消息的基础结构 */
export interface WSBaseMessage {
  type: WSMessageType
  timestamp: number
}

/** 消息类型枚举 */
export type WSMessageType =
  // 系统消息（双向）
  | 'ping'
  | 'pong'
  | 'error'
  | 'auth'
  | 'auth_success'
  | 'auth_failed'
  // 工作区（客户端 → 服务端）
  | 'join_workspace'
  | 'leave_workspace'
  // 在线状态（服务端 → 客户端）
  | 'presence_update'
  | 'presence_list'
  // 评论通知（服务端 → 客户端）
  | 'comment_added'
  | 'comment_resolved'
  // 活动日志（服务端 → 客户端）
  | 'activity'

// ─── 系统消息 ────────────────────────────────────────────────────────────────

export interface WSPingMessage extends WSBaseMessage {
  type: 'ping'
}

export interface WSPongMessage extends WSBaseMessage {
  type: 'pong'
}

export interface WSErrorMessage extends WSBaseMessage {
  type: 'error'
  code: string
  message: string
}

// ─── 认证消息 ────────────────────────────────────────────────────────────────

/** 客户端发送：携带 token 进行鉴权 */
export interface WSAuthMessage extends WSBaseMessage {
  type: 'auth'
  token: string
}

export interface WSAuthSuccessMessage extends WSBaseMessage {
  type: 'auth_success'
  userId: string
}

export interface WSAuthFailedMessage extends WSBaseMessage {
  type: 'auth_failed'
  message: string
}

// ─── 工作区消息 ──────────────────────────────────────────────────────────────

/** 客户端发送：加入工作区频道 */
export interface WSJoinWorkspaceMessage extends WSBaseMessage {
  type: 'join_workspace'
  workspaceId: string
}

/** 客户端发送：离开工作区频道 */
export interface WSLeaveWorkspaceMessage extends WSBaseMessage {
  type: 'leave_workspace'
  workspaceId: string
}

// ─── 在线状态消息 ────────────────────────────────────────────────────────────

export interface WSPresenceUser {
  userId: string
  username: string
  avatar?: string
  status: 'online' | 'away' | 'offline'
  lastSeen: number
}

/** 服务端推送：单个用户状态变更 */
export interface WSPresenceUpdateMessage extends WSBaseMessage {
  type: 'presence_update'
  workspaceId: string
  user: WSPresenceUser
}

/** 服务端推送：工作区当前全量在线成员列表 */
export interface WSPresenceListMessage extends WSBaseMessage {
  type: 'presence_list'
  workspaceId: string
  users: WSPresenceUser[]
}

// ─── 评论通知消息 ────────────────────────────────────────────────────────────

export interface WSCommentPayload {
  commentId: string
  targetType: 'document' | 'prd' | 'prototype'
  targetId: string
  authorId: string
  authorName: string
  content: string
  mentions: string[]
}

/** 服务端推送：新评论添加 */
export interface WSCommentAddedMessage extends WSBaseMessage {
  type: 'comment_added'
  workspaceId: string
  comment: WSCommentPayload
}

/** 服务端推送：评论已解决 */
export interface WSCommentResolvedMessage extends WSBaseMessage {
  type: 'comment_resolved'
  workspaceId: string
  commentId: string
  resolvedBy: string
}

// ─── 活动日志消息 ────────────────────────────────────────────────────────────

export interface WSActivityPayload {
  activityId: string
  userId: string
  username: string
  action: string
  resourceType: string
  resourceId: string
  resourceName?: string
  metadata?: Record<string, unknown>
}

/** 服务端推送：工作区活动日志 */
export interface WSActivityMessage extends WSBaseMessage {
  type: 'activity'
  workspaceId: string
  activity: WSActivityPayload
}

// ─── 联合类型 ────────────────────────────────────────────────────────────────

/** 客户端可发送的所有消息类型 */
export type WSClientMessage =
  | WSPingMessage
  | WSAuthMessage
  | WSJoinWorkspaceMessage
  | WSLeaveWorkspaceMessage

/** 服务端可推送的所有消息类型 */
export type WSServerMessage =
  | WSPongMessage
  | WSErrorMessage
  | WSAuthSuccessMessage
  | WSAuthFailedMessage
  | WSPresenceUpdateMessage
  | WSPresenceListMessage
  | WSCommentAddedMessage
  | WSCommentResolvedMessage
  | WSActivityMessage

/** 所有消息联合类型 */
export type WSMessage = WSClientMessage | WSServerMessage
