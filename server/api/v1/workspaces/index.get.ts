/**
 * 获取所有工作区
 * GET /api/workspaces
 */

import { WorkspaceDAO } from '~/lib/db/dao/workspace-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    requireAuth(event)

    const workspaces = await WorkspaceDAO.getAll()

    // 为每个工作区添加统计信息
    const workspacesWithStats = await Promise.all(
      workspaces.map(async (workspace) => {
        const stats = await WorkspaceDAO.getStats(workspace.id)
        return {
          ...workspace,
          stats
        }
      })
    )

    return {
      success: true,
      data: workspacesWithStats
    }
  } catch (error) {
    console.error('Failed to fetch workspaces:', error)
    throw createError({
      statusCode: 500,
      message: t('errors.fetchWorkspacesFailed')
    })
  }
})
