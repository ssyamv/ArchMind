/**
 * POST /api/v1/prd/batch/archive
 * 批量归档 PRD（软删除，保留历史记录）
 */

import { z } from 'zod'
import { dbClient } from '~/lib/db/client'
import { runBatch } from '~/lib/utils/batch-handler'

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  workspaceId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Schema.parse)
  await requireWorkspaceRole(event, body.workspaceId, 'prd', 'write')

  const result = await runBatch({
    items: body.ids.map(id => ({ id })),
    maxConcurrency: 5,
    handler: async ({ id }) => {
      const prd = await dbClient.query<{ id: string; workspace_id: string }>(
        'SELECT id, workspace_id FROM prd_documents WHERE id = $1',
        [id]
      )
      if (prd.rows.length === 0) {
        throw createError({ statusCode: 404, message: 'PRD 不存在' })
      }
      if (prd.rows[0].workspace_id !== body.workspaceId) {
        throw createError({ statusCode: 403, message: '无权操作此 PRD' })
      }

      // 软删除：将状态设为 archived
      await dbClient.query(
        `UPDATE prd_documents SET status = 'archived', updated_at = NOW() WHERE id = $1`,
        [id]
      )
    },
  })

  return { success: true, data: result }
})
