/**
 * POST /api/categories/:id/move
 * 移动分类到新父级
 */

import { CategoryDAO } from '~/lib/db/dao/category-dao'
import { z } from 'zod'

const moveCategorySchema = z.object({
  newParentId: z.string().uuid().nullable()
})

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
    const body = await readBody(event)

    // 验证输入
    const validationResult = moveCategorySchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    // 移动分类
    const category = await CategoryDAO.move(categoryId, validationResult.data.newParentId)

    if (!category) {
      throw createError({
        statusCode: 404,
        message: t('errors.categoryNotFound')
      })
    }

    return {
      success: true,
      data: { category }
    }
  } catch (error) {
    console.error('Category move error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to move category'
    })
  }
})
