/**
 * GET /api/v1/tasks
 * 获取当前用户的任务列表（最近 20 条）
 */

import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth-helpers'
import { AITaskDAO } from '~/lib/db/dao/ai-task-dao'

const QuerySchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = await getValidatedQuery(event, QuerySchema.parse)
  const tasks = await AITaskDAO.findByUser(userId, { status: query.status, limit: query.limit })
  return { success: true, data: tasks }
})
