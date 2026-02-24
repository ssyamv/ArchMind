/**
 * DELETE /api/tags/:id
 * 删除标签
 */

import { TagDAO } from '~/lib/db/dao/tag-dao'

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
    // 检查标签是否存在
    const tag = await TagDAO.findById(tagId)
    if (!tag) {
      throw createI18nError(event, ErrorKeys.TAG_NOT_FOUND, 404)
    }

    // 删除标签（会自动级联删除 document_tags 关联）
    const deleted = await TagDAO.delete(tagId)

    if (!deleted) {
      throw createError({
        statusCode: 500,
        message: t('errors.deleteTagFailed')
      })
    }

    return {
      success: true,
      data: {
        id: tagId,
        message: t('errors.tagDeletedSuccess')
      }
    }
  } catch (error) {
    console.error('Tag deletion error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.deleteTagFailed')
    })
  }
})
