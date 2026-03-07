/**
 * GET /api/v1/logic-maps
 * 获取逻辑图列表
 */

import { z } from 'zod'
import { MermaidLogicMapDAO } from '~/lib/db/dao/mermaid-logic-map-dao'

const QuerySchema = z.object({
  workspaceId: z.string().uuid(),
  prdId: z.string().uuid().optional(),
  type: z.enum(['flowchart', 'sequence', 'state', 'class']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse)
  await requireWorkspaceRole(event, query.workspaceId, 'logic_map', 'read')

  const result = await MermaidLogicMapDAO.findByWorkspace(
    query.workspaceId,
    { prdId: query.prdId, type: query.type, limit: query.limit, offset: (query.page - 1) * query.limit }
  )

  return { success: true, data: result }
})
