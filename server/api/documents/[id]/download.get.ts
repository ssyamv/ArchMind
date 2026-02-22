/**
 * 文档下载 API（受保护的）
 * 通过预签名 URL 实现安全下载
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { AuditLogDAO } from '~/lib/db/dao/audit-log-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'
import { verifyToken } from '~/server/utils/jwt'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const documentId = getRouterParam(event, 'id')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      message: t('errors.documentIdRequired')
    })
  }

  // 认证检查：从 Cookie 获取 JWT Token
  const token = getCookie(event, 'auth_token')
  if (!token) {
    throw createError({ statusCode: 401, message: '未登录，请先登录' })
  }
  const payload = verifyToken(token)
  if (!payload) {
    throw createError({ statusCode: 401, message: 'Token 无效或已过期' })
  }
  const userId = payload.userId

  try {
    // 查询文档
    const document = await DocumentDAO.findById(documentId)
    if (!document) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      })
    }

    // 权限检查：文档必须属于当前用户（或归属于用户有权限的 workspace）
    if (document.userId && document.userId !== userId) {
      throw createError({ statusCode: 403, message: '无权访问该文档' })
    }

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
