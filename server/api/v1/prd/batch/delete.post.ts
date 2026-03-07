/**
 * POST /api/v1/prd/batch/delete
 * 批量删除 PRD
 */

import { z } from 'zod'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { runBatch } from '~/lib/utils/batch-handler'

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  workspaceId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Schema.parse)
  // 批量删除 PRD 需要 admin+ 权限
  await requireWorkspaceRole(event, body.workspaceId, 'prd', 'delete')

  const result = await runBatch({
    items: body.ids.map(id => ({ id })),
    maxConcurrency: 5,
    handler: async ({ id }) => {
      const prd = await PRDDAO.findById(id)
      if (!prd) throw createError({ statusCode: 404, message: 'PRD 不存在' })
      if (prd.workspaceId && prd.workspaceId !== body.workspaceId) {
        throw createError({ statusCode: 403, message: '无权操作此 PRD' })
      }
      await PRDDAO.delete(id)
    },
  })

  return { success: true, data: result }
})
