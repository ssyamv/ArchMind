/**
 * 获取单个工作区
 * GET /api/workspaces/:id
 */

import { WorkspaceDAO } from '~/lib/db/dao/workspace-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: t('errors.workspaceIdRequired')
      })
    }

    // 验证用户是该工作区成员
    await requireWorkspaceMember(event, id)

    const workspace = await WorkspaceDAO.getById(id)

    if (!workspace) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.WORKSPACE_NOT_FOUND)
      })
    }

    // 添加统计信息
    const stats = await WorkspaceDAO.getStats(id)

    return {
      success: true,
      data: {
        ...workspace,
        stats
      }
    }
  } catch (error: any) {
    console.error('Failed to fetch workspace:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.fetchWorkspaceFailed')
    })
  }
})
