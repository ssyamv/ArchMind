import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { LogicMapDAO } from '~/lib/db/dao/logic-map-dao'
import { LogicCoverageCalculator } from '~/lib/logic-map/coverage-calculator'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'id')

    if (!prdId) {
      setResponseStatus(event, 400)
      return { success: false, error: 'prdId is required' }
    }

    // 获取 PRD
    const prd = await PRDDAO.findById(prdId)
    if (!prd) {
      setResponseStatus(event, 404)
      return { success: false, error: ErrorMessages.PRD_NOT_FOUND }
    }

    requireResourceOwner(prd, userId)

    // 获取 Logic Map
    const logicMapRecord = await LogicMapDAO.findByPrdId(prdId)
    const logicMapData = logicMapRecord ? LogicMapDAO.toLogicMapData(logicMapRecord) : null

    // 计算 Logic Coverage
    const metrics = LogicCoverageCalculator.calculate(prd.content, logicMapData)

    return {
      success: true,
      data: metrics
    }
  } catch (error) {
    console.error('Logic coverage calculation error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
