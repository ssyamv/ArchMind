/**
 * DELETE /api/categories/:id
 * 删除分类（级联删除子分类）
 */

import { CategoryDAO } from '~/lib/db/dao/category-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  requireAuth(event)
  const categoryId = getRouterParam(event, 'id')

  if (!categoryId) {
    throw createError({
      statusCode: 400,
      message: t('errors.categoryIdRequired')
    })
  }

  try {
    // 检查分类是否存在
    const category = await CategoryDAO.findById(categoryId)
    if (!category) {
      throw createError({
        statusCode: 404,
        message: t('errors.categoryNotFound')
      })
    }

    // 检查是否有文档使用此分类
    const documentCount = await CategoryDAO.getDocumentCount(categoryId)
    if (documentCount > 0) {
      throw createError({
        statusCode: 409,
        message: `Cannot delete category: ${documentCount} documents are using this category`
      })
    }

    // 删除分类（会级联删除子分类）
    const deleted = await CategoryDAO.delete(categoryId)

    if (!deleted) {
      throw createError({
        statusCode: 500,
        message: t('errors.deleteCategoryFailed')
      })
    }

    return {
      success: true,
      data: {
        id: categoryId,
        message: t('errors.categoryDeletedSuccess')
      }
    }
  } catch (error) {
    console.error('Category deletion error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.deleteCategoryFailed')
    })
  }
})
