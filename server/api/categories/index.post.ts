/**
 * POST /api/categories
 * 创建分类
 */

import { CategoryDAO } from '~/lib/db/dao/category-dao'
import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional()
})

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)

    const body = await readBody(event)

    // 验证输入
    const validationResult = createCategorySchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    // 创建分类
    const category = await CategoryDAO.create({
      name: validationResult.data.name,
      parentId: validationResult.data.parentId ?? null,
      sortOrder: validationResult.data.sortOrder ?? 0,
      description: validationResult.data.description,
      icon: validationResult.data.icon
    })

    return {
      success: true,
      data: { category }
    }
  } catch (error) {
    console.error('Category creation error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to create category'
    })
  }
})
