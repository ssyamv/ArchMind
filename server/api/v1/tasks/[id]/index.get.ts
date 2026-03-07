/**
 * GET /api/v1/tasks/:id
 * 获取任务详情
 */

import { requireAuth } from '~/server/utils/auth-helpers'
import { AITaskDAO } from '~/lib/db/dao/ai-task-dao'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const task = await AITaskDAO.findById(id)
  if (!task) {
    throw createError({ statusCode: 404, message: '任务不存在' })
  }
  if (task.userId !== userId) {
    throw createError({ statusCode: 403, message: '无权访问此任务' })
  }
  return { success: true, data: task }
})
