/**
 * POST /api/v1/documents/:id/confirm-tags
 * 确认 AI 推荐的自动标签（将 suggested_tags 写入 tags，并标记已确认）
 */

import { dbClient } from '~/lib/db/client'

export default defineEventHandler(async (event) => {
  const docId = getRouterParam(event, 'id')!

  // 获取文档及推荐标签
  const docResult = await dbClient.query<{
    id: string
    workspace_id: string
    suggested_tags: string[] | null
    auto_tags_confidence: number | null
    auto_tags_confirmed: boolean
  }>(
    'SELECT id, workspace_id, suggested_tags, auto_tags_confidence, auto_tags_confirmed FROM documents WHERE id = $1',
    [docId]
  )

  if (docResult.rows.length === 0) {
    throw createError({ statusCode: 404, message: '文档不存在' })
  }

  const doc = docResult.rows[0]

  // 使用 RBAC 权限校验（工作区成员且有 document:write 权限）
  const { userId } = await requireWorkspaceRole(event, doc.workspace_id, 'document', 'write')

  if (!doc.suggested_tags || doc.suggested_tags.length === 0) {
    throw createError({ statusCode: 400, message: '暂无 AI 推荐标签' })
  }

  // 将推荐标签追加到现有标签（去重）
  const existingTags = await dbClient.query<{ name: string }>(
    `SELECT t.name FROM tags t
     JOIN document_tags dt ON dt.tag_id = t.id
     WHERE dt.document_id = $1`,
    [docId]
  )
  const existingTagNames = new Set(existingTags.rows.map(r => r.name))

  // 批量写入新标签
  for (const tagName of doc.suggested_tags) {
    if (existingTagNames.has(tagName)) continue

    // upsert 标签
    const tagResult = await dbClient.query<{ id: string }>(
      `INSERT INTO tags (name, user_id) VALUES ($1, $2)
       ON CONFLICT (name, user_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [tagName, userId]
    )
    const tagId = tagResult.rows[0]?.id
    if (tagId) {
      await dbClient.query(
        `INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [docId, tagId]
      )
    }
  }

  // 标记已确认
  await dbClient.query(
    'UPDATE documents SET auto_tags_confirmed = true, updated_at = NOW() WHERE id = $1',
    [docId]
  )

  return { success: true, message: `已确认 ${doc.suggested_tags.length} 个推荐标签` }
})
