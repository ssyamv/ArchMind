/**
 * GET /api/v1/logic-maps/:id (Mermaid 格式)
 * 获取 Mermaid 逻辑图详情
 *
 * 注意：此文件覆盖同路径的旧版 VueFlow 格式逻辑图查询
 * 旧格式端点已迁移至 generate-from-prd.post.ts
 */

import { MermaidLogicMapDAO } from '~/lib/db/dao/mermaid-logic-map-dao'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id 参数必填' })

  requireAuth(event)

  const map = await MermaidLogicMapDAO.findById(id)
  if (!map) throw createError({ statusCode: 404, message: '逻辑图不存在' })

  await requireWorkspaceRole(event, map.workspaceId, 'logic_map', 'read')

  return { success: true, data: map }
})
