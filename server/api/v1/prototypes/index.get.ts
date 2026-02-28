import { PrototypeDAO } from '~/lib/db/dao/prototype-dao'
import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const query = getQuery(event)
    const prdId = query.prdId as string | undefined
    const workspaceId = query.workspace_id as string | undefined

    // If prdId is provided, filter by it
    if (prdId) {
      // 通过 PRD 归属的工作区来校验访问权限
      const prd = await PRDDAO.findById(prdId)
      if (!prd) {
        setResponseStatus(event, 404)
        return { success: false, message: '项目不存在' }
      }
      if (prd.workspaceId) {
        const isMember = await WorkspaceMemberDAO.isMember(prd.workspaceId, userId)
        if (!isMember) {
          setResponseStatus(event, 403)
          return { success: false, message: '无权访问该工作区' }
        }
      } else if (prd.userId !== userId) {
        setResponseStatus(event, 403)
        return { success: false, message: '无权访问该项目' }
      }
      const prototypes = await PrototypeDAO.findByPrdId(prdId)
      return {
        success: true,
        data: { prototypes, total: prototypes.length, page: 1, limit: prototypes.length }
      }
    }

    // 如果指定了工作区，校验当前用户是否是该工作区成员
    if (workspaceId) {
      const isMember = await WorkspaceMemberDAO.isMember(workspaceId, userId)
      if (!isMember) {
        setResponseStatus(event, 403)
        return { success: false, message: '无权访问该工作区' }
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
