/**
 * POST /api/v1/documents/batch/reprocess
 * 批量重新处理（重新向量化）
 */

import { z } from 'zod'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { runBatch } from '~/lib/utils/batch-handler'
import { processDocumentAsync } from '~/server/utils/document-processing'

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  workspaceId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Schema.parse)
  await requireWorkspaceRole(event, body.workspaceId, 'document', 'write')

  const result = await runBatch({
    items: body.ids.map(id => ({ id })),
    maxConcurrency: 3,
    handler: async ({ id }) => {
      const doc = await DocumentDAO.findById(id)
      if (!doc) throw createError({ statusCode: 404, message: '文档不存在' })
      if (doc.workspaceId && doc.workspaceId !== body.workspaceId) {
        throw createError({ statusCode: 403, message: '无权操作此文档' })
      }

      // 重置处理状态
      await DocumentDAO.update(id, {
        processingStatus: 'pending',
        processingError: null,
        retryCount: 0,
      } as any)

      // 异步触发重新处理（直接调用处理函数，避免内部 HTTP 调用认证问题）
      const content = (doc as any).content || ''
      setImmediate(() => {
        processDocumentAsync(id, content).catch(e => {
          console.warn(`[BatchReprocess] 重新处理失败 ${id}:`, e)
        })
      })
    },
  })

  return { success: true, data: result }
})
