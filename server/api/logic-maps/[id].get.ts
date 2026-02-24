import { LogicMapDAO } from '~/lib/db/dao/logic-map-dao'
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

    // 通过 PRD 归属间接校验
    const prd = await PRDDAO.findById(prdId)
    if (prd) {
      requireResourceOwner({ userId: prd.userId }, userId)
    }

    const logicMapRecord = await LogicMapDAO.findByPrdId(prdId)

    if (!logicMapRecord) {
      return { success: true, data: null }
    }

    const logicMapData = LogicMapDAO.toLogicMapData(logicMapRecord)

    return {
      success: true,
      data: logicMapData
    }
  } catch (error) {
    console.error('Failed to load logic map:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
