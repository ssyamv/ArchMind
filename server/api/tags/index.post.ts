/**
 * POST /api/tags
 * 创建标签
 */

import { TagDAO } from '~/lib/db/dao/tag-dao'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(500).optional()
})

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    requireAuth(event)

    const body = await readBody(event)

    // 验证输入
    const validationResult = createTagSchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    // 检查标签名是否已存在
    const existing = await TagDAO.findByName(validationResult.data.name)
    if (existing) {
      throw createI18nError(event, ErrorKeys.TAG_NAME_EXISTS, 409)
    }

    // 创建标签
    const tag = await TagDAO.create({
      name: validationResult.data.name,
      color: validationResult.data.color ?? '#3B82F6',
      description: validationResult.data.description
    })

    return {
      success: true,
      data: { tag }
    }
  } catch (error) {
    console.error('Tag creation error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.createTagFailed')
    })
  }
})
