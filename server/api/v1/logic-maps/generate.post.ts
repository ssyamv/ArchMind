/**
 * POST /api/v1/logic-maps/generate
 * 基于 PRD 内容 AI 流式生成 Mermaid 逻辑图（SSE）
 */

import { z } from 'zod'
import { PRDDAO } from '~/lib/db/dao/prd-dao'
import { MermaidLogicMapDAO } from '~/lib/db/dao/mermaid-logic-map-dao'
import { MermaidLogicMapGenerator } from '~/lib/logic-map/mermaid-generator'
import { extractMermaidCode } from '~/lib/logic-map/prompts'
import { getModelManager } from '~/lib/ai/manager'

const Schema = z.object({
  prdId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  type: z.enum(['flowchart', 'sequence', 'state', 'class']),
  title: z.string().min(1).max(200),
  focus: z.string().max(500).optional(),
  modelId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Schema.parse)
  const { userId } = await requireWorkspaceRole(event, body.workspaceId, 'logic_map', 'write')

  // 获取 PRD 内容
  const prd = await PRDDAO.findById(body.prdId)
  if (!prd) {
    throw createError({ statusCode: 404, message: 'PRD 不存在' })
  }
  if (prd.workspaceId !== body.workspaceId) {
    throw createError({ statusCode: 403, message: '无权访问此 PRD' })
  }

  // 初始化 AI 模型管理器（使用运行时配置的 API Key）
  const runtimeConfig = useRuntimeConfig()
  getModelManager({
    anthropicApiKey: runtimeConfig.anthropicApiKey,
    openaiApiKey: runtimeConfig.openaiApiKey,
    googleApiKey: runtimeConfig.googleApiKey,
    glmApiKey: runtimeConfig.glmApiKey,
    dashscopeApiKey: runtimeConfig.dashscopeApiKey,
    baiduApiKey: runtimeConfig.baiduApiKey,
    deepseekApiKey: runtimeConfig.deepseekApiKey,
    ollamaBaseUrl: runtimeConfig.ollamaBaseUrl,
  })

  // 设置 SSE 响应头
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'X-Accel-Buffering', 'no')

  const res = event.node.res
  res.flushHeaders?.()

  const generator = new MermaidLogicMapGenerator()
  let fullOutput = ''

  try {
    for await (const chunk of generator.generateStream({
      prdContent: prd.content,
      type: body.type,
      focus: body.focus,
      modelId: body.modelId,
    })) {
      fullOutput += chunk
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
    }

    // 提取 Mermaid 代码
    const mermaidCode = extractMermaidCode(fullOutput) ?? fullOutput.trim()

    // 保存到数据库
    const saved = await MermaidLogicMapDAO.create({
      workspaceId: body.workspaceId,
      prdId: body.prdId,
      userId,
      title: body.title,
      type: body.type,
      mermaidCode,
      focus: body.focus,
    })

    res.write(`data: ${JSON.stringify({ type: 'done', logicMapId: saved.id, mermaidCode })}\n\n`)
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err?.message || '生成失败' })}\n\n`)
  } finally {
    res.end()
  }
})
