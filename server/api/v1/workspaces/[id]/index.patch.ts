/**
 * 更新工作区
 * PATCH /api/workspaces/:id
 */

import { WorkspaceDAO, type UpdateWorkspaceInput } from '~/lib/db/dao/workspace-dao'

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

    const body = await readBody<UpdateWorkspaceInput>(event)

    // 如果更新名称,检查是否已存在
    if (body.name) {
      const existing = await WorkspaceDAO.getByName(body.name)
      if (existing && existing.id !== id) {
        throw createError({
          statusCode: 409,
          message: t(ErrorKeys.WORKSPACE_NAME_EXISTS)
        })
      }
    }

    const workspace = await WorkspaceDAO.update(id, body)

    if (!workspace) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.WORKSPACE_NOT_FOUND)
      })
    }

    return {
      success: true,
      data: workspace
    }
  } catch (error: any) {
    console.error('Failed to update workspace:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.updateWorkspaceFailed')
    })
  }
})
