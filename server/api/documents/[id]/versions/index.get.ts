/**
 * GET /api/documents/:id/versions
 * 查询文档的所有版本历史
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { DocumentVersionDAO } from '~/lib/db/dao/document-version-dao'

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

    // 查询所有版本
    const versions = await DocumentVersionDAO.findByDocumentId(documentId)

    return {
      success: true,
      data: {
        documentId,
        documentTitle: document.title,
        currentVersion: document.currentVersion || 1,
        totalVersions: versions.length,
        versions: versions.map(v => ({
          id: v.id,
          version: v.version,
          fileSize: v.fileSize,
          changeSummary: v.changeSummary,
          createdAt: v.createdAt,
          createdBy: v.createdBy
        }))
      }
    }
  } catch (error) {
    console.error('Get versions error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to get versions'
    })
  }
})
