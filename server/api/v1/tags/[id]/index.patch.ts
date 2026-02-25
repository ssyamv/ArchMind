/**
 * PATCH /api/tags/:id
 * 更新标签
 */

import { TagDAO } from '~/lib/db/dao/tag-dao'
import { z } from 'zod'

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(500).optional()
})

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  requireAuth(event)
  const tagId = getRouterParam(event, 'id')

  if (!tagId) {
    throw createError({
      statusCode: 400,
      message: t('errors.tagIdRequired')
    })
  }

  try {
    const body = await readBody(event)

    // 验证输入
    const validationResult = updateTagSchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    // 如果更新名称,检查是否与其他标签重复
    if (validationResult.data.name) {
      const existing = await TagDAO.findByName(validationResult.data.name)
      if (existing && existing.id !== tagId) {
        throw createI18nError(event, ErrorKeys.TAG_NAME_EXISTS, 409)
      }
    }

    // 更新标签
    const tag = await TagDAO.update(tagId, validationResult.data)

    if (!tag) {
      throw createI18nError(event, ErrorKeys.TAG_NOT_FOUND, 404)
    }

    return {
      success: true,
      data: { tag }
    }
  } catch (error) {
    console.error('Tag update error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.updateTagFailed')
    })
  }
})
