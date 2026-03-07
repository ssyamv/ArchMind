/**
 * PRD 模板引擎（#67）
 * 根据模板章节定义构建专用 System Prompt
 */

import type { PRDTemplate, PRDTemplateSection } from '../db/dao/prd-template-dao'

export class PRDTemplateEngine {
  /**
   * 根据模板构建专用 System Prompt
   * 如模板有自定义 systemPrompt，拼接在章节指令之后
   */
  buildSystemPrompt (template: PRDTemplate): string {
    const sectionInstructions = template.sections
      .map(s => this.buildSectionInstruction(s))
      .join('\n\n')

    const base = `你是一个专业的产品经理，请严格按照以下章节结构生成 PRD：

${sectionInstructions}

重要规则：
1. 严格按照上述章节顺序输出
2. 必填章节不可省略
3. 使用 Markdown 格式，每个章节以 ## 开头
4. 语言清晰、结构化、面向研发团队`

    if (template.systemPrompt) {
      return `${base}\n\n${template.systemPrompt}`
    }
    return base
  }

  private buildSectionInstruction (section: PRDTemplateSection): string {
    const required = section.required ? ' **（必填）**' : '（选填）'
    const minWords = section.minWords ? `\n  - 最少 ${section.minWords} 字` : ''
    const format = section.format === 'as-a-user'
      ? '\n  - 格式：As a [角色], I want [目标], So that [价值]'
      : ''
    return `## ${section.title}${required}\n  ${section.instructions}${minWords}${format}`
  }
}

export const prdTemplateEngine = new PRDTemplateEngine()
