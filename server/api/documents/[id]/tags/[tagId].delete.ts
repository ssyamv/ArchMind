/**
 * DELETE /api/documents/:id/tags/:tagId
 * 从文档移除标签
 */

import { TagDAO } from '~/lib/db/dao/tag-dao'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  const userId = requireAuth(event)
  const documentId = getRouterParam(event, 'id')
  const tagId = getRouterParam(event, 'tagId')

  if (!documentId || !tagId) {
    throw createError({
      statusCode: 400,
      message: t('errors.documentAndTagIdRequired')
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

    // 验证标签存在
    const tag = await TagDAO.findById(tagId)
    if (!tag) {
      throw createError({
        statusCode: 404,
        message: t('errors.tagNotFound')
      })
    }

    // 移除标签
    await TagDAO.removeFromDocument(documentId, tagId)

    // 返回更新后的标签列表
    const tags = await TagDAO.findByDocumentId(documentId)

    return {
      success: true,
      data: {
        documentId,
        tagId,
        tags,
        total: tags.length
      }
    }
  } catch (error) {
    console.error('Document tag removal error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.removeTagFromDocumentFailed')
    })
  }
})
