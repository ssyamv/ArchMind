import { PrototypeDAO } from '~/lib/db/dao/prototype-dao'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const query = getQuery(event)
    const prdId = query.prdId as string | undefined
    const workspaceId = query.workspace_id as string | undefined

    // If prdId is provided, filter by it
    if (prdId) {
      const prototypes = await PrototypeDAO.findByPrdId(prdId)
      return {
        success: true,
        data: { prototypes, total: prototypes.length, page: 1, limit: prototypes.length }
      }
    }

    const page = parseInt((query.page as string) || '1', 10)
    const limit = parseInt((query.limit as string) || '50', 10)
    const offset = (page - 1) * limit

    const [prototypes, total] = await Promise.all([
      PrototypeDAO.findAll({ limit, offset, order: 'DESC', orderBy: 'created_at', workspaceId, userId }),
      PrototypeDAO.count({ workspaceId, userId })
    ])

    return {
      success: true,
      data: { prototypes, total, page, limit }
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
