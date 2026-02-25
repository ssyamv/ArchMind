/**
 * 复制 PRD 项目
 * POST /api/prd/[id]/duplicate
 *
 * 深度克隆 PRD 文档，复制标题（加"副本"后缀）、内容和元数据，
 * 但不复制对话历史和向量数据（副本需要重新生成向量）。
 */

import { PRDDAO } from '~/lib/db/dao/prd-dao'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)

  const prdId = getRouterParam(event, 'id')
  if (!prdId) throw createError({ statusCode: 400, message: '缺少 PRD ID' })

  // 查询原 PRD
  const original = await PRDDAO.findById(prdId)
  if (!original) throw createError({ statusCode: 404, message: 'PRD 不存在' })

  // 权限检查
  requireResourceOwner(original, userId)

  // 创建副本
  const duplicated = await PRDDAO.create({
    userId,
    workspaceId: original.workspaceId,
    title: `${original.title} - 副本`,
    content: original.content,
    userInput: original.userInput,
    modelUsed: original.modelUsed,
    generationTime: original.generationTime,
    tokenCount: original.tokenCount,
    estimatedCost: original.estimatedCost,
    status: 'draft', // 副本始终以草稿状态创建
    metadata: {
      ...(typeof original.metadata === 'object' ? original.metadata : {}),
      duplicatedFrom: prdId,
      duplicatedAt: new Date().toISOString()
    }
  })

  return {
    success: true,
    data: duplicated
  }
})
