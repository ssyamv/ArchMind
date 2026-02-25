import { ErrorMessages } from '~/server/utils/errors'
/**
 * POST /api/documents/duplicates/cleanup
 * 清理重复文档
 *
 * 功能:
 * 1. 对每组重复文档,保留最早创建的一个
 * 2. 删除其他重复文档
 * 3. 同时删除对象存储中的文件
 */

import { dbClient } from '~/lib/db/client'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { getStorageClient } from '~/lib/storage/storage-factory'
import { z } from 'zod'

const cleanupSchema = z.object({
  contentHashes: z.array(z.string()).optional(), // 指定要清理的哈希组,不提供则清理全部
  keepOldest: z.boolean().optional().default(true) // true=保留最早,false=保留最新
})

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const body = await readBody(event)

    // 验证输入
    const validationResult = cleanupSchema.safeParse(body)
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        message: validationResult.error.errors[0].message
      })
    }

    const { contentHashes, keepOldest } = validationResult.data

    // 1. 查询重复文档组
    let sql = `
      SELECT
        content_hash,
        ARRAY_AGG(id ORDER BY created_at ${keepOldest ? 'ASC' : 'DESC'}) as document_ids
      FROM documents
      WHERE content_hash IS NOT NULL
        AND (user_id = $1 OR user_id IS NULL)
    `

    const params: any[] = [userId]

    if (contentHashes && contentHashes.length > 0) {
      sql += ` AND content_hash = ANY($2)`
      params.push(contentHashes)
    }

    sql += `
      GROUP BY content_hash
      HAVING COUNT(*) > 1
    `

    const result = await dbClient.query<{
      content_hash: string
      document_ids: string[]
    }>(sql, params)

    let deletedCount = 0
    let freedSpace = 0
    const errors: string[] = []

    // 2. 对每组重复文档,删除除第一个外的所有文档
    const storage = getStorageClient()

    for (const row of result.rows) {
      const [, ...deleteIds] = row.document_ids

      for (const docId of deleteIds) {
        try {
          // 获取文档信息
          const doc = await DocumentDAO.findById(docId)
          if (!doc) {
            continue
          }

          // 删除对象存储中的文件
          if (doc.storageKey) {
            await storage.deleteFile(doc.storageKey)
          }

          // 删除数据库记录
          await DocumentDAO.delete(docId)

          deletedCount++
          freedSpace += doc.fileSize || 0
        } catch (error) {
          console.error(`删除文档失败 (${docId}):`, error)
          errors.push(`Failed to delete document ${docId}: ${error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR}`)
        }
      }
    }

    return {
      success: true,
      data: {
        deletedCount,
        freedSpace,
        keptDocuments: result.rows.length,
        errors: errors.length > 0 ? errors : undefined
      }
    }
  } catch (error) {
    console.error('Cleanup duplicates error:', error)

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to cleanup duplicates'
    })
  }
})
