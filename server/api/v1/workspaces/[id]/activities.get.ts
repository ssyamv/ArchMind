/**
 * 获取工作区活动日志
 * GET /api/v1/workspaces/:id/activities
 */

import { z } from 'zod'
import { ActivityLogDAO } from '~/lib/db/dao/activity-log-dao'
import { requireWorkspaceMember } from '~/server/utils/auth-helpers'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.string().optional(),
  userId: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) throw createError({ statusCode: 400, message: 'Workspace ID is required' })

  await requireWorkspaceMember(event, workspaceId)

  const query = await getValidatedQuery(event, QuerySchema.parse)

  const [activities, total] = await Promise.all([
    ActivityLogDAO.findByWorkspace(workspaceId, {
      limit: query.limit,
      offset: query.offset,
      action: query.action,
      userId: query.userId
    }),
    ActivityLogDAO.countByWorkspace(workspaceId)
  ])

  return {
    success: true,
    data: activities,
    pagination: { total, limit: query.limit, offset: query.offset }
  }
})
