/**
 * 文档重新索引 API
 * POST /api/documents/reindex
 *
 * 对指定 workspace 下所有已完成处理的文档重新做 embedding 向量化，
 * 适用于更换 embedding 模型后需要重建向量索引的场景。
 */

import { z } from 'zod'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { VectorDAO } from '~/lib/db/dao/vector-dao'
import { DocumentProcessingPipeline } from '~/lib/rag/pipeline'
import { EmbeddingServiceFactory } from '~/lib/rag/embedding-adapter'

const BodySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).optional()
})

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)

  const body = await readBody(event)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: '参数无效：请提供 workspaceId 或 documentIds' })
  }
  const { workspaceId, documentIds: inputDocumentIds } = parsed.data

  if (!workspaceId && (!inputDocumentIds || inputDocumentIds.length === 0)) {
    throw createError({ statusCode: 400, message: '请提供 workspaceId 或 documentIds' })
  }

  // 获取需要重索引的文档列表
  let targetDocIds: string[] = inputDocumentIds || []

  if (workspaceId && targetDocIds.length === 0) {
    const docs = await DocumentDAO.findAll({ workspaceId, userId, limit: 1000 })
    targetDocIds = docs.map(d => d.id)
  }

  if (targetDocIds.length === 0) {
    return { success: true, data: { processed: 0, failed: 0, message: '没有需要重索引的文档' } }
  }

  // 初始化 embedding 服务
  const embeddingAdapter = await EmbeddingServiceFactory.createAvailable({
    glmApiKey: process.env.GLM_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY
  })

  if (!embeddingAdapter) {
    throw createError({ statusCode: 503, message: 'Embedding 服务不可用，请检查 API Key 配置' })
  }

  const pipeline = new DocumentProcessingPipeline({ embeddingAdapter })

  let processed = 0
  let failed = 0
  const errors: Array<{ documentId: string; error: string }> = []

  for (const docId of targetDocIds) {
    try {
      const doc = await DocumentDAO.findById(docId)
      if (!doc || !doc.content) {
        // 跳过没有内容的文档
        continue
      }

      // 验证文档归属
      requireResourceOwner(doc, userId)

      // 清理旧向量（保留 chunks��
      await VectorDAO.deleteByDocumentId(docId)

      // 重新用 pipeline 处理（仅向量化阶段）
      await pipeline.reindex(docId, doc.content)

      processed++
    } catch (err: any) {
      failed++
      errors.push({ documentId: docId, error: err.message || '未知错误' })
      console.error(`[Reindex] Failed for document ${docId}:`, err)
    }
  }

  return {
    success: true,
    data: {
      total: targetDocIds.length,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      message: `重新索引完成：成功 ${processed} 个，失败 ${failed} 个`
    }
  }
})
