/**
 * GET /api/tags
 * 查询所有标签
 */

import { TagDAO } from '~/lib/db/dao/tag-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    requireAuth(event)

    const query = getQuery(event)
    const search = query.search as string | undefined
    const popular = query.popular === 'true'
    const limit = query.limit ? parseInt(query.limit as string, 10) : undefined

    let tags

    if (search) {
      // 搜索标签
      tags = await TagDAO.search(search, limit || 20)
    } else if (popular) {
      // 热门标签
      tags = await TagDAO.findPopular(limit || 10)
    } else {
      // 所有标签
      tags = await TagDAO.findAll()
    }

    return {
      success: true,
      data: {
        tags,
        total: tags.length
      }
    }
  } catch (error) {
    console.error('Tags query error:', error)

    throw createError({
      statusCode: 500,
      message: t('errors.fetchTagsFailed')
    })
  }
})
