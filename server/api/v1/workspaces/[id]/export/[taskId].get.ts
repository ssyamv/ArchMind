/**
 * GET /api/v1/workspaces/:id/export/:taskId
 * 查询导出任务进度（从 ai_tasks 表获取真实状态）
 */

import { AITaskDAO } from '~/lib/db/dao/ai-task-dao'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const taskId = getRouterParam(event, 'taskId')

  if (!workspaceId || !taskId) {
    throw createError({ statusCode: 400, message: '参数缺失' })
  }

  await requireWorkspaceRole(event, workspaceId, 'workspace', 'read')

  const task = await AITaskDAO.findById(taskId)
  if (!task || task.workspaceId !== workspaceId) {
    throw createError({ statusCode: 404, message: '任务不存在' })
  }

  return {
    success: true,
    data: {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      error: task.error,
      outputRef: task.outputRef,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    },
  }
})
