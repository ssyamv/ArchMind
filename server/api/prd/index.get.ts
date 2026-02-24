import { PRDDAO } from '~/lib/db/dao/prd-dao'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const query = getQuery(event)
    const page = parseInt((query.page as string) || '1', 10)
    const limit = parseInt((query.limit as string) || '50', 10)
    const offset = (page - 1) * limit
    const workspaceId = query.workspace_id as string | undefined

    // 返回所有项目,包括未生成 PRD 的对话
    const [prds, total] = await Promise.all([
      PRDDAO.findAll({
        limit,
        offset,
        order: 'DESC',
        orderBy: 'created_at',
        workspaceId,
        userId
      }),
      PRDDAO.count({ workspaceId, userId })
    ])

    return {
      success: true,
      data: {
        prds,
        total,
        page,
        limit
      }
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
