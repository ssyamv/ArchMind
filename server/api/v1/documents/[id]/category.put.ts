/**
 * PUT /api/documents/:id/category
 * 设置文档的分类
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { CategoryDAO } from '~/lib/db/dao/category-dao'
import { z } from 'zod'

const setCategorySchema = z.object({
  categoryId: z.string().uuid().nullable()
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
    const validationResult = setCategorySchema.safeParse(body)
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

    // 如果设置了分类，验证分类存在
    const { categoryId } = validationResult.data
    if (categoryId) {
      const category = await CategoryDAO.findById(categoryId)
      if (!category) {
        throw createError({
          statusCode: 404,
          message: t('errors.categoryNotFound')
        })
      }
    }

    // 更新文档分类
    const updatedDocument = await DocumentDAO.update(documentId, { categoryId })

    if (!updatedDocument) {
      throw createError({
        statusCode: 500,
        message: t('errors.updateDocumentCategoryFailed')
      })
    }

    // 获取分类详情
    let category = null
    if (updatedDocument.categoryId) {
      category = await CategoryDAO.findById(updatedDocument.categoryId)
    }

    return {
      success: true,
      data: {
        documentId,
        categoryId: updatedDocument.categoryId,
        category
      }
    }
  } catch (error) {
    console.error('Document category update error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.updateDocumentCategoryFailed')
    })
  }
})
