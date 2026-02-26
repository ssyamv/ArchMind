/**
 * 删除工作区
 * DELETE /api/workspaces/:id
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

    // 只有工作区 owner 才能删除
    await requireWorkspaceMember(event, id, 'owner')

    const deleted = await WorkspaceDAO.delete(id)

    if (!deleted) {
      throw createError({
        statusCode: 404,
        message: t(ErrorKeys.WORKSPACE_NOT_FOUND)
      })
    }

    return {
      success: true,
      message: t('errors.workspaceDeletedSuccess')
    }
  } catch (error: any) {
    console.error('Failed to delete workspace:', error)

    if (error.statusCode) {
      throw error
    }

    if (error.message === 'Cannot delete default workspace') {
      throw createError({
        statusCode: 400,
        message: t(ErrorKeys.CANNOT_DELETE_DEFAULT)
      })
    }

    throw createError({
      statusCode: 500,
      message: t('errors.deleteWorkspaceFailed')
    })
  }
})
