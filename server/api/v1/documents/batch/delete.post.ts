/**
 * POST /api/v1/documents/batch/delete
 * 批量删除文档
 */

import { z } from 'zod'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { runBatch } from '~/lib/utils/batch-handler'

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100, '最多支持 100 条'),
  workspaceId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Schema.parse)
  await requireWorkspaceRole(event, body.workspaceId, 'document', 'delete')

  const result = await runBatch({
    items: body.ids.map(id => ({ id })),
    maxConcurrency: 5,
    handler: async ({ id }) => {
      const doc = await DocumentDAO.findById(id)
      if (!doc) {
        throw createError({ statusCode: 404, message: '文档不存在' })
      }
      // 校验文档归属于该工作区
      if (doc.workspaceId && doc.workspaceId !== body.workspaceId) {
        throw createError({ statusCode: 403, message: '无权操作此文档' })
      }
      await DocumentDAO.delete(id)
    },
  })

  return { success: true, data: result }
})
