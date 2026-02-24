/**
 * 文档下载 API（受保护的）
 * 通过预签名 URL 实现安全下载
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { AuditLogDAO } from '~/lib/db/dao/audit-log-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      message: t('errors.documentIdRequired')
    })
  }

  const userId = requireAuth(event)

  try {
    // 查询文档
    const document = await DocumentDAO.findById(documentId)
    if (!document) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      })
    }

    requireResourceOwner(document, userId)

    // 检查文档是否存储在对象存储中
    if (!document.storageKey) {
      throw createError({
        statusCode: 400,
        message: t('errors.documentNotInStorage')
      })
    }

    // 生成预签名 URL（有效期 1 小时）
    const storage = getStorageClient()
    const presignedUrl = await storage.generatePresignedUrl(
      document.storageKey,
      3600  // 1 小时有效期
    )

    console.log(`[Download] userId=${userId} documentId=${documentId} fileName=${document.title}`)

    // 写入审计日志
    await AuditLogDAO.create({
      userId,
      workspaceId: document.workspaceId || null,
      action: 'document.download',
      resourceType: 'document',
      resourceId: documentId,
      ipAddress: getRequestIP(event, { xForwardedFor: true }),
      userAgent: getHeader(event, 'user-agent'),
      metadata: { fileName: document.title, fileType: document.fileType }
    })

    // 重定向到预签名 URL
    return sendRedirect(event, presignedUrl)
  } catch (error) {
    console.error('Download error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.generateDownloadLinkFailed')
    })
  }
})
