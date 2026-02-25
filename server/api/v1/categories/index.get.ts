/**
 * GET /api/categories
 * 查询所有分类或分类树
 */

import { CategoryDAO } from '~/lib/db/dao/category-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    requireAuth(event)

    const query = getQuery(event)
    const tree = query.tree === 'true'
    const parentId = query.parentId as string | undefined

    let result

    if (tree) {
      // 返回分类树
      result = await CategoryDAO.buildTree()
      return {
        success: true,
        data: {
          tree: result
        }
      }
    } else if (parentId) {
      // 返回某分类的子分类
      const categories = await CategoryDAO.findChildren(parentId)
      return {
        success: true,
        data: {
          categories,
          total: categories.length
        }
      }
    } else if (query.root === 'true') {
      // 返回顶级分类
      const categories = await CategoryDAO.findRootCategories()
      return {
        success: true,
        data: {
          categories,
          total: categories.length
        }
      }
    } else {
      // 返回所有分类
      const categories = await CategoryDAO.findAll()
      return {
        success: true,
        data: {
          categories,
          total: categories.length
        }
      }
    }
  } catch (error) {
    console.error('Categories query error:', error)

    throw createError({
      statusCode: 500,
      message: t('errors.fetchCategoriesFailed')
    })
  }
})
