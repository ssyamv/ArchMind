import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { LogicMapDAO } from '~/lib/db/dao/logic-map-dao'
import { LogicCoverageCalculator } from '~/lib/logic-map/coverage-calculator'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)

    const query = getQuery(event)
    const prdIds = query.prdIds as string | string[] | undefined

    if (!prdIds) {
      setResponseStatus(event, 400)
      return { success: false, error: 'prdIds is required' }
    }

    // 确保 prdIds 是数组
    const ids = Array.isArray(prdIds) ? prdIds : [prdIds]

    // 批量获取 PRD 和 Logic Map,计算 Coverage
    const results: Record<string, number> = {}

    await Promise.all(
      ids.map(async (prdId) => {
        try {
          const prd = await PRDDAO.findById(prdId)
          if (!prd) {
            results[prdId] = 0
            return
          }

          const logicMapRecord = await LogicMapDAO.findByPrdId(prdId)
          const logicMapData = logicMapRecord ? LogicMapDAO.toLogicMapData(logicMapRecord) : null

          results[prdId] = LogicCoverageCalculator.calculateQuick(prd.content, logicMapData)
        } catch (error) {
          console.error(`Error calculating coverage for PRD ${prdId}:`, error)
          results[prdId] = 0
        }
      })
    )

    return {
      success: true,
      data: results
    }
  } catch (error) {
    console.error('Batch logic coverage calculation error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
