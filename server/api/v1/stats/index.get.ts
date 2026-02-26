import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { dbClient } from '~/lib/db/client'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)

    // 统计当前用户的向量化块数量（按 userId 隔离）
    const [docCount, prdCount, vectorResult] = await Promise.all([
      DocumentDAO.count({ userId }),
      PRDDAO.count({ userId }),
      dbClient.query<{ count: string }>(
        `SELECT COUNT(DISTINCT e.chunk_id) as count
         FROM document_embeddings e
         JOIN document_chunks dc ON dc.id = e.chunk_id
         JOIN documents d ON d.id = dc.document_id
         WHERE d.user_id = $1`,
        [userId]
      )
    ])

    const vectorCount = parseInt(vectorResult.rows[0]?.count || '0', 10)

    return {
      success: true,
      data: {
        documents: docCount,
        prds: prdCount,
        vectors: vectorCount
      }
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    })
  }
})
