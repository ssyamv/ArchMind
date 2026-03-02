/**
 * 文档异步处理工具
 * 供 upload.post.ts 和 batch-upload.post.ts 共用
 */

import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { DocumentProcessingPipeline } from '~/lib/rag/pipeline'
import { createEmbeddingAdapter } from '~/server/utils/embedding'

/**
 * 异步处理文档向量化（fire-and-forget）
 * 调用方不需要 await，失败不影响主流程
 */
export async function processDocumentAsync(documentId: string, content: string): Promise<void> {
  console.log(`[AsyncQueue] Starting processing for document: ${documentId}`)

  await DocumentDAO.updateProcessingStatus(documentId, 'processing', {
    startedAt: new Date()
  })

  try {
    const runtimeConfig = useRuntimeConfig()
    const glmApiKey = runtimeConfig.glmApiKey as string | undefined

    const embeddingAdapter = await createEmbeddingAdapter({ glmApiKey })

    if (embeddingAdapter) {
      const modelInfo = embeddingAdapter.getModelInfo()
      console.log(`[AsyncQueue] Using ${modelInfo.provider} embedding for document: ${documentId}`)

      const pipeline = new DocumentProcessingPipeline({ embeddingAdapter })
      const result = await pipeline.process(documentId, content)

      await DocumentDAO.updateProcessingStatus(documentId, 'completed', {
        chunksCount: result.chunksCreated,
        vectorsCount: result.vectorsAdded,
        completedAt: new Date()
      })

      console.log(`[AsyncQueue] Completed: ${documentId} (chunks=${result.chunksCreated}, vectors=${result.vectorsAdded})`)
    } else {
      console.warn('[AsyncQueue] No embedding API key configured, skipping vectorization')
      await DocumentDAO.updateProcessingStatus(documentId, 'completed', {
        completedAt: new Date()
      })
    }
  } catch (error) {
    console.error(`[AsyncQueue] Failed for document ${documentId}:`, error)
    await DocumentDAO.updateProcessingStatus(documentId, 'failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date()
    })
  }
}
