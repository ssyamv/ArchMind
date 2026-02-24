/**
 * 文档处理日志查询 API
 * 返回文档处理过程中的详细日志
 */

import { ProcessingLogDAO } from '~/lib/db/dao/processing-log-dao'
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
    // 验证父资源归属
    const document = await DocumentDAO.findById(documentId)
    if (!document) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      })
    }
    requireResourceOwner(document, userId)

    // 查询文档的所有处理日志
    const logs = await ProcessingLogDAO.findByDocumentId(documentId)

    return {
      success: true,
      data: {
        documentId,
        logs: logs.map(log => ({
          id: log.id,
          stage: log.stage,
          status: log.status,
          message: log.message,
          metadata: log.metadata,
          durationMs: log.durationMs,
          timestamp: log.createdAt
        })),
        total: logs.length
      }
    }
  } catch (error) {
    console.error('Logs query error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.fetchProcessingLogsFailed')
    })
  }
})
