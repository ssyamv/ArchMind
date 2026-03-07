/**
 * GET /api/v1/search/suggestions
 * 搜索自动补全建议（需验证工作区成员身份）
 */

import { z } from 'zod'
import { globalSearcher } from '~/lib/search/global-searcher'

const QuerySchema = z.object({
  q: z.string().min(1).max(100),
  workspaceId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse)
  // 验证用户是工作区成员（至少有 read 权限）
  await requireWorkspaceRole(event, query.workspaceId, 'document', 'read')
  const suggestions = await globalSearcher.suggestions(query.q, query.workspaceId)
  return { success: true, data: suggestions }
})
