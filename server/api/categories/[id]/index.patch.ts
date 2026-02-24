/**
 * PATCH /api/categories/:id
 * 更新分类
 */

import { CategoryDAO } from '~/lib/db/dao/category-dao'
import { z } from 'zod'

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional()
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
    const validationResult = updateCategorySchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    // 更新分类
    const category = await CategoryDAO.update(categoryId, validationResult.data)

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
    console.error('Category update error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to update category'
    })
  }
})
