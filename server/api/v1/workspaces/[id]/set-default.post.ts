/**
 * 设置默认工作区
 * POST /api/workspaces/:id/set-default
 */

import { WorkspaceDAO } from '~/lib/db/dao/workspace-dao'
import { ConfigDAO } from '~/lib/db/dao/config-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    requireAuth(event)

    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: t('errors.workspaceIdRequired')
      })
    }

    const workspace = await WorkspaceDAO.setDefault(id)

    if (!workspace) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.WORKSPACE_NOT_FOUND)
      })
    }

    // 更新系统配置中的活跃工作区
    await ConfigDAO.set('active_workspace_id', { value: id }, '当前活跃的工作区 ID')

    return {
      success: true,
      data: workspace
    }
  } catch (error: any) {
    console.error('Failed to set default workspace:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.setDefaultWorkspaceFailed')
    })
  }
})
