import { PRDDAO } from '~/lib/db/dao/prd-dao'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'id')
    if (!prdId) {
      setResponseStatus(event, 400)
      return { success: false, error: 'prdId is required' }
    }

    // 查找 PRD 并校验归属权
    const prd = await PRDDAO.findById(prdId)
    if (!prd) {
      setResponseStatus(event, 404)
      return { success: false, error: ErrorMessages.PRD_NOT_FOUND }
    }
    requireResourceOwner(prd, userId)

    // 解析请求体
    const body = await readBody(event)

    // 验证更新字段
    const allowedFields = ['title', 'content', 'status', 'metadata']
    const updates: any = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      setResponseStatus(event, 400)
      return { success: false, error: 'No valid fields to update' }
    }

    // 更新 PRD
    const updatedPrd = await PRDDAO.update(prdId, updates)

    if (!updatedPrd) {
      setResponseStatus(event, 404)
      return { success: false, error: ErrorMessages.PRD_NOT_FOUND }
    }

    return {
      success: true,
      data: updatedPrd
    }
  } catch (error) {
    console.error('Failed to update PRD:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
