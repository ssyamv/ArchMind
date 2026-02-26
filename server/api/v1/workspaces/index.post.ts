/**
 * 创建工作区
 * POST /api/workspaces
 */

import { WorkspaceDAO, type CreateWorkspaceInput } from '~/lib/db/dao/workspace-dao'
import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)

    const body = await readBody<CreateWorkspaceInput>(event)

    // 验证必需字段
    if (!body.name || !body.name.trim()) {
      throw createError({
        statusCode: 400,
        message: t('errors.workspaceNameRequired')
      })
    }

    // 检查名称是否已存在
    const existing = await WorkspaceDAO.getByName(body.name)
    if (existing) {
      throw createError({
        statusCode: 409,
        message: t(ErrorKeys.WORKSPACE_NAME_EXISTS)
      })
    }

    const workspace = await WorkspaceDAO.create(body)

    // 将创建者添加为工作区 owner
    await WorkspaceMemberDAO.addMember(workspace.id, userId, 'owner')

    return {
      success: true,
      data: workspace
    }
  } catch (error: any) {
    console.error('Failed to create workspace:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: t('errors.createWorkspaceFailed')
    })
  }
})
