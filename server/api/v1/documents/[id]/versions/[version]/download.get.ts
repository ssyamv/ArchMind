/**
 * GET /api/documents/:id/versions/:version/download
 * 下载文档的特定版本
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { DocumentVersionDAO } from '~/lib/db/dao/document-version-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const userId = requireAuth(event)
  const documentId = getRouterParam(event, 'id')
  const versionStr = getRouterParam(event, 'version')

  if (!documentId || !versionStr) {
    throw createError({
      statusCode: 400,
      message: t('errors.documentVersionIdRequired')
    })
  }

  const version = parseInt(versionStr)
  if (isNaN(version) || version < 1) {
    throw createError({
      statusCode: 400,
      message: t('errors.invalidVersionNumber')
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

    // 查询版本
    const versionDoc = await DocumentVersionDAO.findByDocumentIdAndVersion(
      documentId,
      version
    )

    if (!versionDoc) {
      throw createError({
        statusCode: 404,
        message: `Version ${version} not found`
      })
    }

    // 生成预签名 URL
    const storage = getStorageClient()
    const presignedUrl = await storage.generatePresignedUrl(
      versionDoc.storageKey,
      3600 // 1小时有效期
    )

    // 重定向到预签名 URL
    return sendRedirect(event, presignedUrl)
  } catch (error) {
    console.error('Download version error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to download version'
    })
  }
})
