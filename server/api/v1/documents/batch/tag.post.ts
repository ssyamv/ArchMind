/**
 * POST /api/v1/documents/batch/tag
 * 批量添加/移除标签（通过 tags + document_tags 关联表）
 */

import { z } from 'zod'
import { DocumentDAO } from '~/lib/db/dao/document-dao'
import { dbClient } from '~/lib/db/client'
import { runBatch } from '~/lib/utils/batch-handler'

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  workspaceId: z.string().uuid(),
  options: z.object({
    addTags: z.array(z.string()).optional(),
    removeTags: z.array(z.string()).optional(),
  }),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Schema.parse)
  await requireWorkspaceRole(event, body.workspaceId, 'document', 'write')

  const { addTags = [], removeTags = [] } = body.options

  const result = await runBatch({
    items: body.ids.map(id => ({ id })),
    maxConcurrency: 5,
    handler: async ({ id }) => {
      const doc = await DocumentDAO.findById(id)
      if (!doc) throw createError({ statusCode: 404, message: '文档不存在' })
      if (doc.workspaceId && doc.workspaceId !== body.workspaceId) {
        throw createError({ statusCode: 403, message: '无权操作此文档' })
      }

      // 移除标签：通过 document_tags + tags 关联删除
      if (removeTags.length > 0) {
        await dbClient.query(
          `DELETE FROM document_tags
           WHERE document_id = $1 AND tag_id IN (
             SELECT id FROM tags WHERE name = ANY($2)
           )`,
          [id, removeTags]
        )
      }

      // 添加标签：upsert tag 记录 + 关联
      for (const tagName of addTags) {
        const tagResult = await dbClient.query<{ id: string }>(
          `INSERT INTO tags (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [tagName]
        )
        const tagId = tagResult.rows[0]?.id
        if (tagId) {
          await dbClient.query(
            `INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id, tagId]
          )
        }
      }
    },
  })

  return { success: true, data: result }
})
