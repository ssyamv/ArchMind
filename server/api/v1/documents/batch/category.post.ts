/**
 * POST /api/v1/documents/batch/category
 * 批量设置文档分类
 */

import { z } from 'zod'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { runBatch } from '~/lib/utils/batch-handler'

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  workspaceId: z.string().uuid(),
  options: z.object({
    category: z.string().min(1),
  }),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Schema.parse)
  await requireWorkspaceRole(event, body.workspaceId, 'document', 'write')

  const result = await runBatch({
    items: body.ids.map(id => ({ id })),
    maxConcurrency: 5,
    handler: async ({ id }) => {
      const doc = await DocumentDAO.findById(id)
      if (!doc) throw createError({ statusCode: 404, message: '文档不存在' })
      if (doc.workspaceId && doc.workspaceId !== body.workspaceId) {
        throw createError({ statusCode: 403, message: '无权操作此文档' })
      }
      await DocumentDAO.update(id, {
        metadata: { ...(doc.metadata as any), category: body.options.category }
      })
    },
  })

  return { success: true, data: result }
})
