/**
 * 文档自动分类与标签生成（#68）
 * 文档向量化完成后异步触发，提取前 2000 字分析
 */

import { dbClient } from '../db/client'
import { getModelManager } from '../ai/manager'

export interface AutoTagResult {
  suggestedCategory: string
  suggestedTags: string[]
  documentType: 'prd' | 'design' | 'technical' | 'report' | 'other'
  confidence: number
  summary: string
}

const AUTO_TAG_PROMPT = `你是文档分类助手。请分析以下文档内容（前2000字），返回严格的 JSON 格式分类结果，不要有任何多余文字或代码块标记。

文档内容：
{content}

必须返回以下格式的 JSON（只输出 JSON，不要有 markdown 代码块）：
{
  "suggestedCategory": "产品需求",
  "suggestedTags": ["标签1", "标签2"],
  "documentType": "prd",
  "confidence": 0.92,
  "summary": "文档摘要，不超过100字"
}

documentType 可选值：prd / design / technical / report / other
suggestedCategory 可选值：产品需求 / 技术设计 / 用户研究 / 竞品分析 / 项目管理 / 运营数据 / 培训材料 / 其他
suggestedTags 最多5个，每个标签不超过10字`

export class AutoTagger {
  async analyze (documentId: string): Promise<AutoTagResult | null> {
    // 获取文档内容
    const result = await dbClient.query<{
      id: string
      title: string
      content: string | null
    }>(
      'SELECT id, title, content FROM documents WHERE id = $1',
      [documentId]
    )

    if (result.rows.length === 0) return null

    const doc = result.rows[0]
    const contentSample = (doc.content ?? doc.title).slice(0, 2000)

    const modelManager = getModelManager()
    const adapter = modelManager.getAdapter(modelManager.getDefaultModelId())
    if (!adapter) return null

    const prompt = AUTO_TAG_PROMPT.replace('{content}', contentSample)

    let rawResponse: string
    try {
      rawResponse = await adapter.generateText(prompt, {
        maxTokens: 300,
        temperature: 0.3,
      })
    } catch (e) {
      console.warn('[AutoTagger] AI 调用失败', e)
      return null
    }

    return this.parseResponse(rawResponse)
  }

  private parseResponse (raw: string): AutoTagResult | null {
    try {
      // 尝试提取 JSON（处理模型可能包裹的 markdown 代码块）
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const parsed = JSON.parse(jsonMatch[0]) as Partial<AutoTagResult>

      // 基础校验
      if (!parsed.suggestedCategory || !Array.isArray(parsed.suggestedTags)) return null

      return {
        suggestedCategory: String(parsed.suggestedCategory).slice(0, 100),
        suggestedTags: parsed.suggestedTags.slice(0, 5).map(t => String(t).slice(0, 20)),
        documentType: (['prd', 'design', 'technical', 'report', 'other'].includes(parsed.documentType as string)
          ? parsed.documentType
          : 'other') as AutoTagResult['documentType'],
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
        summary: String(parsed.summary ?? '').slice(0, 200),
      }
    } catch {
      return null
    }
  }

  /** 将 AI 分析结果写入数据库 */
  static async saveResult (documentId: string, result: AutoTagResult): Promise<void> {
    await dbClient.query(
      `UPDATE documents
       SET suggested_category = $1,
           suggested_tags = $2,
           auto_summary = $3,
           auto_doc_type = $4,
           auto_tags_confidence = $5,
           auto_tags_confirmed = false,
           updated_at = NOW()
       WHERE id = $6`,
      [
        result.suggestedCategory,
        result.suggestedTags,
        result.summary,
        result.documentType,
        result.confidence,
        documentId,
      ]
    )
  }
}

export const autoTagger = new AutoTagger()
