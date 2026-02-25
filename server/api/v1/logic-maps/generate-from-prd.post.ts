import { LogicMapGenerator } from '~/lib/logic-map/generator'
import { getModelManager } from '~/lib/ai/manager'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { LogicMapDAO } from '~/lib/db/dao/logic-map-dao'
import type { LogicMapGenerateRequest } from '~/types/logic-map'

import { ErrorMessages } from '~/server/utils/errors'
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const body = await readBody<LogicMapGenerateRequest>(event)

    if (!body.prdId) {
      setResponseStatus(event, 400)
      return { success: false, error: 'prdId is required' }
    }

    // 获取 PRD 内容
    const prd = await PRDDAO.findById(body.prdId)
    if (!prd) {
      setResponseStatus(event, 404)
      return { success: false, error: ErrorMessages.PRD_NOT_FOUND }
    }

    // PRD 归属校验
    requireResourceOwner({ userId: prd.userId }, userId)

    const runtimeConfig = useRuntimeConfig()
    const config = {
      anthropicApiKey: runtimeConfig.anthropicApiKey,
      openaiApiKey: runtimeConfig.openaiApiKey,
      googleApiKey: runtimeConfig.googleApiKey,
      glmApiKey: runtimeConfig.glmApiKey,
      dashscopeApiKey: runtimeConfig.dashscopeApiKey,
      baiduApiKey: runtimeConfig.baiduApiKey,
      deepseekApiKey: runtimeConfig.deepseekApiKey,
      ollamaBaseUrl: runtimeConfig.ollamaBaseUrl
    }

    const modelManager = getModelManager(config)
    const modelId = body.modelId || modelManager.getDefaultModelId()

    const generator = new LogicMapGenerator(config)
    const logicMapData = await generator.generateFromPRD(prd.content, {
      modelId,
      temperature: body.temperature,
      maxTokens: body.maxTokens || 4000
    })

    // 保存到数据库
    await LogicMapDAO.upsert(body.prdId, logicMapData, {
      modelId,
      generatedAt: new Date().toISOString()
    })

    return { success: true, data: logicMapData }
  } catch (error) {
    console.error('Logic map generation error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : ErrorMessages.UNKNOWN_ERROR
    }
  }
})
