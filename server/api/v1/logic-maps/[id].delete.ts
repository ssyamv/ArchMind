/**
 * DELETE /api/v1/logic-maps/:id
 * 删除 Mermaid 逻辑图
 */

import { MermaidLogicMapDAO } from '~/lib/db/dao/mermaid-logic-map-dao'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id 参数必填' })

  requireAuth(event)

  const map = await MermaidLogicMapDAO.findById(id)
  if (!map) throw createError({ statusCode: 404, message: '逻辑图不存在' })

  await requireWorkspaceRole(event, map.workspaceId, 'logic_map', 'delete')

  await MermaidLogicMapDAO.delete(id)

  return { success: true }
})
