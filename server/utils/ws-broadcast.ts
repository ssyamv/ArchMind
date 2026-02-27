/**
 * WebSocket 广播工具函数
 *
 * 供服务端其他模块（评论 API、活动日志等）调用，
 * 向指定工作区的在线成员推送实时消息。
 *
 * 使用 Nitro 的全局 peer 发布订阅机制（useStorage + publish）
 * 注意：此工具只能在服务端（Nitro handler）内使用
 */

import type {
  WSCommentPayload,
  WSActivityPayload
} from '~/types/websocket'

/**
 * 向工作区广播评论新增事件
 */
export function broadcastCommentAdded(
  peer: any,
  workspaceId: string,
  comment: WSCommentPayload
): void {
  peer.publish(`workspace:${workspaceId}`, JSON.stringify({
    type: 'comment_added',
    workspaceId,
    comment,
    timestamp: Date.now()
  }))
}

/**
 * 向工作区广播评论解决事件
 */
export function broadcastCommentResolved(
  peer: any,
  workspaceId: string,
  commentId: string,
  resolvedBy: string
): void {
  peer.publish(`workspace:${workspaceId}`, JSON.stringify({
    type: 'comment_resolved',
    workspaceId,
    commentId,
    resolvedBy,
    timestamp: Date.now()
  }))
}

/**
 * 向工作区广播活动日志事件
 */
export function broadcastActivity(
  peer: any,
  workspaceId: string,
  activity: WSActivityPayload
): void {
  peer.publish(`workspace:${workspaceId}`, JSON.stringify({
    type: 'activity',
    workspaceId,
    activity,
    timestamp: Date.now()
  }))
}
