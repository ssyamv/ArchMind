/**
 * GET /api/documents/duplicates
 * 查询重复文档组
 *
 * 功能:
 * 1. 查找具有相同 content_hash 的文档组
 * 2. 按重复数量排序
 * 3. 返回每组中的所有文档详情
 */

import { dbClient } from '~/lib/db/client'
import { DocumentDAO } from '~/lib/db/dao/document-dao'

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)

    // 1. 查询重复的文档组 (相同 content_hash,数量 > 1)
    const sql = `
      SELECT
        content_hash,
        COUNT(*) as count,
        ARRAY_AGG(id) as document_ids
      FROM documents
      WHERE content_hash IS NOT NULL
        AND (user_id = $1 OR user_id IS NULL)
      GROUP BY content_hash
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `

    const result = await dbClient.query<{
      content_hash: string
      count: string
      document_ids: string[]
    }>(sql, [userId])

    // 2. 获取每组文档的详细信息
    const duplicateGroups = await Promise.all(
      result.rows.map(async row => {
        const documents = await Promise.all(
          row.document_ids.map(id => DocumentDAO.findById(id))
        )

        // 过滤掉 null 值
        const validDocuments = documents.filter(d => d !== null)

        return {
          contentHash: row.content_hash,
          count: parseInt(row.count, 10),
          totalSize: validDocuments.reduce((sum, doc) => sum + (doc?.fileSize || 0), 0),
          documents: validDocuments.map(doc => ({
            id: doc!.id,
            title: doc!.title,
            fileType: doc!.fileType,
            fileSize: doc!.fileSize,
            storageProvider: doc!.storageProvider,
            createdAt: doc!.createdAt,
            processingStatus: doc!.processingStatus
          }))
        }
      })
    )

    // 3. 计算总重复数和可节省空间
    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.count - 1, 0)
    const wastedSpace = duplicateGroups.reduce(
      (sum, group) => sum + (group.documents[0]?.fileSize || 0) * (group.count - 1),
      0
    )

    return {
      success: true,
      data: {
        totalGroups: duplicateGroups.length,
        totalDuplicates,
        wastedSpace,
        duplicateGroups
      }
    }
  } catch (error) {
    console.error('Query duplicates error:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to query duplicates'
    })
  }
})
