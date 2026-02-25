/**
 * GET /api/tags/:id
 * 查询单个标签详情
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
    const tag = await TagDAO.findById(tagId)

    if (!tag) {
      throw createI18nError(event, ErrorKeys.TAG_NOT_FOUND, 404)
    }

    // 查询使用此标签的文档 ID
    const documentIds = await TagDAO.findDocumentsByTagId(tagId)

    return {
      success: true,
      data: {
        tag,
        documentCount: documentIds.length,
        documentIds
      }
    }
  } catch (error) {
    console.error('Tag query error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.fetchTagFailed')
    })
  }
})
