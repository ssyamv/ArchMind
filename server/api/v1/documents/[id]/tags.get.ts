/**
 * GET /api/documents/:id/tags
 * 查询文档的所有标签
 */

import { TagDAO } from '~/lib/db/dao/tag-dao'
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
    // 验证文档存在
    const document = await DocumentDAO.findById(documentId)
    if (!document) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      })
    }

    requireResourceOwner(document, userId)

    // 查询文档的所有标签
    const tags = await TagDAO.findByDocumentId(documentId)

    return {
      success: true,
      data: {
        documentId,
        tags,
        total: tags.length
      }
    }
  } catch (error) {
    console.error('Document tags query error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.fetchDocumentTagsFailed')
    })
  }
})
