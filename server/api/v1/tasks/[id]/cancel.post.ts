/**
 * POST /api/v1/tasks/:id/cancel
 * 取消任务（pending/running → cancelled）
 */

import { requireAuth } from '~/server/utils/auth-helpers'
import { AITaskDAO } from '~/lib/db/dao/ai-task-dao'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const cancelled = await AITaskDAO.cancel(id, userId)
  if (!cancelled) {
    throw createError({ statusCode: 400, message: '任务不存在或已完成，无法取消' })
  }
  return { success: true }
})
