/**
 * Mermaid 逻辑图谱 AI 生成引擎
 * 基于 PRD 内容，AI 流式生成 Mermaid 语法代码
 */

import { getModelManager } from '~/lib/ai/manager'
import {
  buildLogicMapSystemPrompt,
  buildLogicMapUserPrompt,
  extractMermaidCode,
  type LogicMapType,
} from '~/lib/logic-map/prompts'

export interface GenerateMermaidLogicMapRequest {
  prdContent: string
  type: LogicMapType
  focus?: string
  modelId?: string
}

export class MermaidLogicMapGenerator {
  /**
   * 流式生成 Mermaid 逻辑图（边生成边推送 SSE）
   * 返回 AsyncGenerator，调用方负责推送 SSE
   */
  async *generateStream (request: GenerateMermaidLogicMapRequest): AsyncGenerator<string> {
    const modelManager = getModelManager()
    const adapter = request.modelId
      ? modelManager.getAdapter(request.modelId)
      : modelManager.selectModelByTask('logic_map_generate') || modelManager.getAdapter(modelManager.getDefaultModelId())

    if (!adapter) {
      throw new Error('无可用的 AI 模型，请检查 API 配置')
    }

    const systemPrompt = buildLogicMapSystemPrompt(request.type)
    const userPrompt = buildLogicMapUserPrompt(request.prdContent, request.type, request.focus)

    yield* adapter.generateStream(userPrompt, {
      systemPrompt,
      temperature: 0.4,
      maxTokens: 2000,
    })
  }

  /**
   * 非流式生成，返回 Mermaid 代码字符串
   */
  async generate (request: GenerateMermaidLogicMapRequest): Promise<string> {
    let fullOutput = ''
    for await (const chunk of this.generateStream(request)) {
      fullOutput += chunk
    }
    return extractMermaidCode(fullOutput) ?? fullOutput
  }
}
