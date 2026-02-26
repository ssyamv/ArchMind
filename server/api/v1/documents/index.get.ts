import { DocumentDAO } from '~/lib/db/dao/document-dao'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const query = getQuery(event)
    const page = Math.max(1, parseInt((query.page as string) || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '50', 10)))
    const offset = (page - 1) * limit
    const workspaceId = query.workspace_id as string | undefined

    const [documents, total] = await Promise.all([
      DocumentDAO.findAll({ limit, offset, order: 'DESC', orderBy: 'created_at', workspaceId, userId }),
      DocumentDAO.count({ workspaceId, userId })
    ])

    return {
      success: true,
      data: {
        documents,
        total,
        page,
        limit
      }
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    })
  }
})
