/**
 * GET /api/v1/search
 * 全局搜索：文档、PRD、逻辑图
 */

import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth-helpers'
import { globalSearcher, type SearchType } from '~/lib/search/global-searcher'
import { dbClient } from '~/lib/db/client'

const QuerySchema = z.object({
  q: z.string().min(1).max(200),
  workspaceId: z.string().uuid(),
  types: z.string().optional(),  // 逗号分隔：document,prd,logic_map
})

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = await getValidatedQuery(event, QuerySchema.parse)

  // 校验用户是工作区成员
  const member = await dbClient.query(
    'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [query.workspaceId, userId]
  )
  if (member.rows.length === 0) {
    throw createError({ statusCode: 403, message: '无权访问此工作区' })
  }

  const types = query.types
    ? (query.types.split(',').filter(t => ['document', 'prd', 'logic_map'].includes(t)) as SearchType[])
    : undefined

  const results = await globalSearcher.search(query.q, query.workspaceId, types)
  return { success: true, data: results }
})
