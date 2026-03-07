/**
 * POST /api/v1/tasks/:id/retry
 * 重试失败的任务（创建新任务，复用原始输入参数）
 */

import { requireAuth } from '~/server/utils/auth-helpers'
import { AITaskDAO } from '~/lib/db/dao/ai-task-dao'
import { aiTaskManager } from '~/lib/tasks/task-manager'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const task = await AITaskDAO.findById(id)
  if (!task) {
    throw createError({ statusCode: 404, message: '任务不存在' })
  }
  if (task.userId !== userId) {
    throw createError({ statusCode: 403, message: '无权操作此任务' })
  }
  if (task.status !== 'failed' && task.status !== 'cancelled') {
    throw createError({ statusCode: 400, message: '只有失败或已取消的任务才能重试' })
  }

  // 创建一个新任务（保留原始输入参数以供重新执行）
  const { task: newTask, queued } = await aiTaskManager.createTask({
    workspaceId: task.workspaceId,
    userId: task.userId,
    type: task.type,
    title: task.title ?? undefined,
    input: task.input ?? undefined,
  })

  // 标记原任务为已取消（避免混淆）
  if (task.status !== 'cancelled') {
    await AITaskDAO.updateStatus(id, 'cancelled')
  }

  return {
    success: true,
    data: {
      newTaskId: newTask.id,
      queued,
      message: queued ? '任务已排队，等待执行' : '任务已重新开始',
    },
  }
})
