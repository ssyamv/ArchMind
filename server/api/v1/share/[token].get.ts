/**
 * 通过分享令牌访问文档 API
 * 验证令牌有效性并生成下载链接
 */

import { dbClient } from '~/lib/db/client'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({
      statusCode: 400,
      message: t('errors.shareTokenRequired')
    })
  }

  try {
    // 查询访问令牌
    const tokenResult = await dbClient.query(
      'SELECT * FROM document_access_tokens WHERE token = $1',
      [token]
    )

    if (tokenResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: t('errors.shareLinkNotFound')
      })
    }

    const accessToken = tokenResult.rows[0]

    // 检查是否过期
    if (new Date(accessToken.expires_at) < new Date()) {
      throw createError({
        statusCode: 403,
        message: t('errors.shareLinkExpired')
      })
    }

    // 检查访问次数限制
    if (accessToken.access_count >= accessToken.max_access_count) {
      throw createError({
        statusCode: 403,
        message: t('errors.shareLinkMaxAccess')
      })
    }

    // 查询文档
    const document = await DocumentDAO.findById(accessToken.document_id)
    if (!document) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.DOCUMENT_NOT_FOUND)
      })
    }

    // 增加访问计数
    await dbClient.query(
      'UPDATE document_access_tokens SET access_count = access_count + 1 WHERE id = $1',
      [accessToken.id]
    )

    // 生成预签名 URL（有效期 30 分钟）
    const storage = getStorageClient()
    const presignedUrl = await storage.generatePresignedUrl(
      document.storageKey!,
      1800  // 30 分钟
    )

    console.log(`Shared document accessed via token: ${token.substring(0, 8)}..., documentId: ${document.id}`)

    // 重定向到预签名 URL
    return sendRedirect(event, presignedUrl)
  } catch (error) {
    console.error('Share access error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.accessSharedDocumentFailed')
    })
  }
})
