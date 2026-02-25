/**
 * POST /api/documents/:id/tags
 * 为文档添加标签
 */

import { TagDAO } from '~/lib/db/dao/tag-dao'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { z } from 'zod'

const addTagSchema = z.object({
  tagId: z.string().uuid()
})

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
    const body = await readBody(event)

    // 验证输入
    const validationResult = addTagSchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

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
    const { tagId } = validationResult.data
    const tag = await TagDAO.findById(tagId)
    if (!tag) {
      throw createError({
        statusCode: 404,
        message: t('errors.tagNotFound')
      })
    }

    // 添加标签
    await TagDAO.addToDocument(documentId, tagId)

    // 返回更新后的标签列表
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
    console.error('Document tag addition error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.addTagToDocumentFailed')
    })
  }
})
