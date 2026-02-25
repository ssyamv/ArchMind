/**
 * SSE 文档处理状态推送
 * GET /api/documents/:id/events
 *
 * 替代客户端轮询 /api/documents/:id/status
 * 当文档处理状态变更时实时推送给客户端
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'

/** 轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 2000
/** 最长推送时间（毫秒），防止僵尸连接 */
const MAX_DURATION_MS = 10 * 60 * 1000 // 10 分钟

function calculateProgress (doc: any): number {
  if (doc.processingStatus === 'completed') return 100
  if (doc.processingStatus === 'failed') return 0
  if (doc.processingStatus === 'processing') {
    if (doc.chunksCount > 0 && doc.vectorsCount > 0) {
      return Math.min(90, (doc.vectorsCount / doc.chunksCount) * 90)
    }
    return 50
  }
  return 0
}

export default defineEventHandler(async (event) => {
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const userId = requireAuth(event)

  // 验证文档存在
  const document = await DocumentDAO.findById(documentId)
  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  requireResourceOwner(document, userId)

  const eventStream = createEventStream(event)
  const startTime = Date.now()
  let lastStatus = ''

  // 如果文档已经处于终态，直接推一次就结束
  const terminalStatuses = ['completed', 'failed']
  if (terminalStatuses.includes(document.processingStatus || '')) {
    await eventStream.push({
      event: 'status',
      data: JSON.stringify({
        documentId,
        status: document.processingStatus,
        progress: calculateProgress(document),
        chunksCount: document.chunksCount,
        vectorsCount: document.vectorsCount,
        error: document.processingError,
        completedAt: document.processingCompletedAt
      })
    })
    await eventStream.close()
    return eventStream.send()
  }

  // 周期性轮询数据库，将状态变更推送给客户端
  const interval = setInterval(async () => {
    try {
      // 超时保护
      if (Date.now() - startTime > MAX_DURATION_MS) {
        clearInterval(interval)
        await eventStream.push({
          event: 'timeout',
          data: JSON.stringify({ message: 'SSE connection timeout' })
        })
        await eventStream.close()
        return
      }

      const doc = await DocumentDAO.findById(documentId)
      if (!doc) {
        clearInterval(interval)
        await eventStream.close()
        return
      }

      const statusPayload = {
        documentId,
        status: doc.processingStatus,
        progress: calculateProgress(doc),
        chunksCount: doc.chunksCount,
        vectorsCount: doc.vectorsCount,
        error: doc.processingError,
        startedAt: doc.processingStartedAt,
        completedAt: doc.processingCompletedAt
      }

      // 只在状态变更时推送（或强制每 30 秒发送一次心跳）
      const statusKey = `${doc.processingStatus}-${doc.chunksCount}-${doc.vectorsCount}`
      const isHeartbeat = (Date.now() - startTime) % 30_000 < POLL_INTERVAL_MS + 200

      if (statusKey !== lastStatus || isHeartbeat) {
        lastStatus = statusKey
        await eventStream.push({
          event: 'status',
          data: JSON.stringify(statusPayload)
        })
      }

      // 终态时关闭连接
      if (terminalStatuses.includes(doc.processingStatus || '')) {
        clearInterval(interval)
        await eventStream.close()
      }
    } catch (err) {
      console.error('[SSE] Error polling document status:', err)
      clearInterval(interval)
      await eventStream.close()
    }
  }, POLL_INTERVAL_MS)

  // 客户端断开时清理资源
  eventStream.onClosed(() => {
    clearInterval(interval)
  })

  return eventStream.send()
})
