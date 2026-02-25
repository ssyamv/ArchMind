/**
 * 生成临时分享链接 API
 * 创建带时效和访问次数限制的分享令牌
 */

import { nanoid } from 'nanoid'
import { dbClient } from '~/lib/db/client'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const userId = requireAuth(event)
  const documentId = getRouterParam(event, 'id')
  const body = await readBody(event)

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

    // 解析分享参数
    const expiryHours = body.expiryHours || 24  // 默认 24 小时
    const maxAccessCount = body.maxAccessCount || 10  // 默认最多 10 次访问

    // 生成随机令牌
    const token = nanoid(32)

    // 计算过期时间
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000)

    // 创建访问令牌
    const sql = `
      INSERT INTO document_access_tokens (
        document_id, token, expires_at, max_access_count
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `

    const result = await dbClient.query(sql, [
      documentId,
      token,
      expiresAt.toISOString(),
      maxAccessCount
    ])

    const accessToken = result.rows[0]

    // 生成分享链接
    const baseUrl = process.env.BASE_URL || process.env.APP_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/share/${token}`

    console.log(`Share link generated for document: ${documentId}`)

    return {
      success: true,
      data: {
        token,
        shareUrl,
        expiresAt: accessToken.expires_at,
        maxAccessCount: accessToken.max_access_count,
        documentTitle: document.title
      }
    }
  } catch (error) {
    console.error('Share link generation error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.generateShareLinkFailed')
    })
  }
})
