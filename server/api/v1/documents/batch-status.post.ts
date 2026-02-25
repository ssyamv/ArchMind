/**
 * POST /api/documents/batch-status
 * 批量查询文档处理状态
 *
 * 用途: 批量上传后，前端通过此接口轮询多个文档的处理进度
 * 请求体: { documentIds: string[] }
 * 响应: 各文档的 processingStatus、progress、chunks/vectors 数量
 */

import { z } from 'zod'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

const BodySchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100)
})

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)

  const body = await readBody(event)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: parsed.error.errors[0]?.message || 'Invalid request body'
    })
  }

  const { documentIds } = parsed.data

  // 批量查询（避免 N+1）
  const docMap = await DocumentDAO.findByIds(documentIds)

  const statuses = documentIds.map((id) => {
    const doc = docMap.get(id)
    if (!doc) {
      return { documentId: id, found: false }
    }

    // 只返回属于当前用户的文档状态
    if (doc.userId && doc.userId !== userId) {
      return { documentId: id, found: false }
    }

    return {
      documentId: id,
      found: true,
      title: doc.title,
      status: doc.processingStatus,
      error: doc.processingError,
      chunksCount: doc.chunksCount,
      vectorsCount: doc.vectorsCount,
      startedAt: doc.processingStartedAt,
      completedAt: doc.processingCompletedAt,
      progress: calculateProgress(doc)
    }
  })

  const allDone = statuses.every(
    s => !s.found || s.status === 'completed' || s.status === 'failed'
  )

  return {
    success: true,
    data: {
      statuses,
      allCompleted: allDone,
      summary: {
        total: documentIds.length,
        pending: statuses.filter(s => s.status === 'pending').length,
        processing: statuses.filter(s => s.status === 'processing').length,
        completed: statuses.filter(s => s.status === 'completed').length,
        failed: statuses.filter(s => s.status === 'failed').length
      }
    }
  }
})

function calculateProgress(document: any): number {
  if (document.processingStatus === 'completed') return 100
  if (document.processingStatus === 'failed') return 0
  if (document.processingStatus === 'processing') {
    if (document.chunksCount > 0 && document.vectorsCount > 0) {
      return Math.min(90, (document.vectorsCount / document.chunksCount) * 90)
    }
    return 50
  }
  return 0
}
