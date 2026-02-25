/**
 * 清理文档 Embedding 缓存
 * DELETE /api/documents/cache
 *
 * 删除指定 workspace 下所有文档的向量块，
 * 让文档回到"待处理"状态，等待重新索引。
 */

import { z } from 'zod'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { DocumentChunkDAO } from '~/lib/db/dao/document-chunk-dao'
import { VectorDAO } from '~/lib/db/dao/vector-dao'

const QuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)

  const query = await getValidatedQuery(event, QuerySchema.parse)

  let documentIds: string[] = []

  if (query.documentId) {
    // 清理单个文档的缓存 - 先验证归属
    const doc = await DocumentDAO.findById(query.documentId)
    if (!doc) {
      throw createError({ statusCode: 404, message: '文档不存在' })
    }
    requireResourceOwner(doc, userId)
    documentIds = [query.documentId]
  } else if (query.workspaceId) {
    // 清理整个 workspace 的缓存 - 只清理属于自己的文档
    const docs = await DocumentDAO.findAll({ workspaceId: query.workspaceId, userId, limit: 1000 })
    documentIds = docs.map(d => d.id)
  } else {
    throw createError({ statusCode: 400, message: '请提供 workspaceId 或 documentId' })
  }

  let deletedChunks = 0
  let deletedVectors = 0

  for (const docId of documentIds) {
    // 删除向量
    const vCount = await VectorDAO.deleteByDocumentId(docId)
    deletedVectors += vCount

    // 删除文档块
    const cCount = await DocumentChunkDAO.deleteByDocumentId(docId)
    deletedChunks += cCount

    // 重置文档处理状态
    await DocumentDAO.updateProcessingStatus(docId, 'pending')
  }

  return {
    success: true,
    data: {
      documentsAffected: documentIds.length,
      deletedChunks,
      deletedVectors,
      message: `已清理 ${documentIds.length} 个文档的向量缓存，共删除 ${deletedChunks} 个文本块、${deletedVectors} 个向量`
    }
  }
})
