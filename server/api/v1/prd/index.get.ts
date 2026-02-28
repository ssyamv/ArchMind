import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'
import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const query = getQuery(event)
    const page = Math.max(1, parseInt((query.page as string) || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '50', 10)))
    const offset = (page - 1) * limit
    const workspaceId = query.workspace_id as string | undefined

    // 如果指定了工作区，校验当前用户是否是该工作区成员
    if (workspaceId) {
      const isMember = await WorkspaceMemberDAO.isMember(workspaceId, userId)
      if (!isMember) {
        setResponseStatus(event, 403)
        return { success: false, message: '无权访问该工作区' }
      }
    }

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
