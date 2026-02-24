/**
 * GET /api/categories/:id
 * 查询单个分类详情
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
    const category = await CategoryDAO.findById(categoryId)

    if (!category) {
      throw createError({
        statusCode: 404,
        message: t('errors.categoryNotFound')
      })
    }

    // 查询分类下的文档数量
    const documentCount = await CategoryDAO.getDocumentCount(categoryId)

    // 查询子分类
    const children = await CategoryDAO.findChildren(categoryId)

    // 查询面包屑
    const breadcrumb = await CategoryDAO.getBreadcrumb(categoryId)

    return {
      success: true,
      data: {
        category,
        documentCount,
        childrenCount: children.length,
        children,
        breadcrumb
      }
    }
  } catch (error) {
    console.error('Category query error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.fetchCategoryFailed')
    })
  }
})
