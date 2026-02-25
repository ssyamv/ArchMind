/**
 * 文档处理状态查询 API
 * 用于前端实时展示文档处理进度
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const userId = requireAuth(event)
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      message: t('errors.documentIdRequired')
    })
  }

  try {
    const document = await DocumentDAO.findById(documentId)

    if (!document) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      })
    }

    requireResourceOwner(document, userId)

    // 返回处理状态信息
    return {
      success: true,
      data: {
        documentId: document.id,
        title: document.title,
        status: document.processingStatus,
        error: document.processingError,
        retryCount: document.retryCount,
        chunksCount: document.chunksCount,
        vectorsCount: document.vectorsCount,
        startedAt: document.processingStartedAt,
        completedAt: document.processingCompletedAt,
        progress: calculateProgress(document)
      }
    }
  } catch (error) {
    console.error('Status query error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.fetchDocumentStatusFailed')
    })
  }
})

/**
 * 计算处理进度百分比
 */
function calculateProgress(document: any): number {
  if (document.processingStatus === 'completed') {
    return 100
  }

  if (document.processingStatus === 'failed') {
    return 0
  }

  if (document.processingStatus === 'processing') {
    // 根据已完成的块数量和向量数量估算进度
    if (document.chunksCount > 0 && document.vectorsCount > 0) {
      return Math.min(90, (document.vectorsCount / document.chunksCount) * 90)
    }
    return 50  // 默认50%
  }

  return 0  // pending or retrying
}
