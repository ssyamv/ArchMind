/**
 * POST /api/v1/documents/batch/auto-tag
 * 批量触发文档自动标签分析（与 #63 批量操作联动）
 */

import { z } from 'zod'
import { requireWorkspaceRole } from '~/server/utils/auth-helpers'
import { autoTagger, AutoTagger } from '~/lib/classification/auto-tagger'

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  workspaceId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, BodySchema.parse)
  await requireWorkspaceRole(event, body.workspaceId, 'document', 'write')

  // 异步触发，不等待完成
  setImmediate(async () => {
    for (const id of body.ids) {
      try {
        const result = await autoTagger.analyze(id)
        if (result) {
          await AutoTagger.saveResult(id, result)
        }
      } catch (e) {
        console.warn(`[AutoTag] 文档 ${id} 自动标签失败`, e)
      }
    }
  })

  return {
    success: true,
    message: `已触发 ${body.ids.length} 个文档的自动标签分析，结果将在后台处理完成`,
  }
})
