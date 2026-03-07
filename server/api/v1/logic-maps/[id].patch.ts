/**
 * PATCH /api/v1/logic-maps/:id
 * 更新 Mermaid 逻辑图（标题 / 代码 / SVG 缓存）
 */

import { z } from 'zod'
import { MermaidLogicMapDAO } from '~/lib/db/dao/mermaid-logic-map-dao'

const Schema = z.object({
  title: z.string().min(1).max(200).optional(),
  mermaidCode: z.string().min(1).optional(),
  svgCache: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id 参数必填' })

  const body = await readValidatedBody(event, Schema.parse)
  requireAuth(event)

  const map = await MermaidLogicMapDAO.findById(id)
  if (!map) throw createError({ statusCode: 404, message: '逻辑图不存在' })

  await requireWorkspaceRole(event, map.workspaceId, 'logic_map', 'write')

  const updated = await MermaidLogicMapDAO.update(id, body)

  return { success: true, data: updated }
})
