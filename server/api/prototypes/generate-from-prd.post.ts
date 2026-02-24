import { PrototypeGenerator } from '~/lib/prototype/generator'
import { getModelManager } from '~/lib/ai/manager'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { PrototypeDAO, PrototypePageDAO } from '~/lib/db/dao/prototype-dao'
import type { PrototypeGenerateFromPRDRequest } from '~/types/prototype'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)
  try {
    const userId = requireAuth(event)
    const body = await readBody<PrototypeGenerateFromPRDRequest>(event)

    if (!body.prdId) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.prdIdFieldRequired') }
    }

    // 获取 PRD 内容
    const prd = await PRDDAO.findById(body.prdId)
    if (!prd) {
      setResponseStatus(event, 404)
      return { success: false, message: t(ErrorKeys.PRD_NOT_FOUND) }
    }

    // 校验 PRD 归属权
    requireResourceOwner(prd, userId)

    // 设置 SSE 响应头
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')

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

    const generator = new PrototypeGenerator(undefined, config)

    let fullContent = ''
    const stream = generator.generateFromPRD(prd.content, {
      modelId,
      temperature: body.temperature,
      maxTokens: body.maxTokens || 16000,
      pageCount: body.pageCount,
      deviceType: body.deviceType
    })

    for await (const chunk of stream) {
      fullContent += chunk
      event.node.res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`)
    }

    // 解析多页面输出
    const parsedPages = PrototypeGenerator.parseMultiPageOutput(fullContent)

    // 保存到数据库
    const prototype = await PrototypeDAO.create({
      prdId: body.prdId,
      userId,
      title: prd.title ? `${prd.title} - 原型` : '原型图',
      description: `从 PRD 自动生成`,
      currentVersion: 1,
      status: 'draft',
      deviceType: body.deviceType || 'responsive'
    })

    const savedPages = await PrototypePageDAO.batchCreate(
      parsedPages.map((p, index) => ({
        prototypeId: prototype.id,
        pageName: p.pageName,
        pageSlug: p.pageSlug,
        htmlContent: p.htmlContent,
        sortOrder: index,
        isEntryPage: index === 0
      }))
    )

    // 发送完成信号
    event.node.res.write(`data: ${JSON.stringify({
      chunk: '',
      done: true,
      prototypeId: prototype.id,
      pages: savedPages.map(p => ({
        id: p.id,
        pageSlug: p.pageSlug,
        pageName: p.pageName
      }))
    })}\n\n`)
    event.node.res.end()
  } catch (error) {
    console.error('Prototype generation error:', error)
    try {
      event.node.res.write(`data: ${JSON.stringify({
        error: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR),
        done: true
      })}\n\n`)
      event.node.res.end()
    } catch {
      setResponseStatus(event, 500)
      return {
        success: false,
        message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
      }
    }
  }
})
