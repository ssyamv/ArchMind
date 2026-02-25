import { z } from 'zod'
import { PRDDAO } from '~/lib/db/dao/prd-dao'

const QuerySchema = z.object({
  format: z.enum(['docx', 'md'])
})

export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const id = getRouterParam(event, 'id')

    if (!id) {
      setResponseStatus(event, 400)
      return { success: false, message: 'PRD ID is required' }
    }

    const query = await getValidatedQuery(event, QuerySchema.parse)

    const prd = await PRDDAO.findById(id)

    if (!prd) {
      setResponseStatus(event, 404)
      return { success: false, message: 'PRD not found' }
    }

    requireResourceOwner(prd, userId)

    const dateStr = new Date().toISOString().slice(0, 10)
    const safeTitle = prd.title
      .replace(/[/\\:*?"<>|]/g, '')
      .trim()
      .slice(0, 50)
    const filename = `PRD-${safeTitle}-${dateStr}`

    // --- Markdown 导出 ---
    if (query.format === 'md') {
      setResponseHeaders(event, {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.md`
      })
      return prd.content
    }

    // --- Word 导出 ---
    const {
      Document,
      Paragraph,
      TextRun,
      HeadingLevel,
      Packer,
      AlignmentType,
      LevelFormat
    } = await import('docx')

    const children: InstanceType<typeof Paragraph>[] = []

    // 文档标题
    children.push(
      new Paragraph({
        text: prd.title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 }
      })
    )

    // 生成时间副标题
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `生成时间：${new Date(prd.createdAt).toLocaleDateString('zh-CN')}`,
            color: '888888',
            size: 20
          })
        ],
        spacing: { after: 400 }
      })
    )

    const lines = (prd.content || '').split('\n')

    for (const line of lines) {
      // H1: # 标题
      if (/^# (?!#)/.test(line)) {
        children.push(
          new Paragraph({
            text: line.replace(/^# /, ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 120 }
          })
        )
        continue
      }

      // H2: ## 标题
      if (/^## (?!#)/.test(line)) {
        children.push(
          new Paragraph({
            text: line.replace(/^## /, ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 }
          })
        )
        continue
      }

      // H3: ### 标题
      if (/^### (?!#)/.test(line)) {
        children.push(
          new Paragraph({
            text: line.replace(/^### /, ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 80 }
          })
        )
        continue
      }

      // H4: #### 标题
      if (/^#### /.test(line)) {
        children.push(
          new Paragraph({
            text: line.replace(/^#### /, ''),
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 160, after: 60 }
          })
        )
        continue
      }

      // 无序列表: - 或 *
      if (/^[-*] /.test(line)) {
        const bulletText = line.replace(/^[-*] /, '')
        children.push(
          new Paragraph({
            children: parseInlineMarkdown(bulletText, TextRun),
            bullet: { level: 0 }
          })
        )
        continue
      }

      // 缩进无序列表:   - 或   *
      if (/^ {2,4}[-*] /.test(line)) {
        const bulletText = line.replace(/^ {2,4}[-*] /, '')
        children.push(
          new Paragraph({
            children: parseInlineMarkdown(bulletText, TextRun),
            bullet: { level: 1 }
          })
        )
        continue
      }

      // 有序列表: 1. 2. 等
      if (/^\d+\. /.test(line)) {
        const listText = line.replace(/^\d+\. /, '')
        children.push(
          new Paragraph({
            children: parseInlineMarkdown(listText, TextRun),
            numbering: {
              reference: 'default-numbering',
              level: 0
            }
          })
        )
        continue
      }

      // 水平分割线
      if (/^[-*_]{3,}$/.test(line.trim())) {
        children.push(
          new Paragraph({
            text: '',
            spacing: { before: 100, after: 100 }
          })
        )
        continue
      }

      // 代码块开始/结束标记 — 作为普通段落处理
      if (/^```/.test(line)) {
        continue
      }

      // 空行
      if (line.trim() === '') {
        children.push(new Paragraph({ text: '' }))
        continue
      }

      // 普通段落（处理行内格式）
      children.push(
        new Paragraph({
          children: parseInlineMarkdown(line, TextRun),
          spacing: { after: 80 }
        })
      )
    }

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: { indent: { left: 360, hanging: 260 } }
                }
              }
            ]
          }
        ]
      },
      sections: [
        {
          children
        }
      ]
    })

    const buffer = await Packer.toBuffer(doc)

    setResponseHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.docx`
    })

    return buffer
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    setResponseStatus(event, 500)
    return { success: false, message: error instanceof Error ? error.message : 'Export failed' }
  }
})

/**
 * 解析行内 Markdown 格式（粗体、斜体、行内代码），返回 TextRun 数组
 */
function parseInlineMarkdown (text: string, TextRun: any): any[] {
  // 移除行内代码反引号但保留内容
  const processed = text.replace(/`([^`]+)`/g, '$1')

  const runs: any[] = []
  // 匹配 **bold**, *italic*, 普通文本
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(processed)) !== null) {
    // 前置普通文本
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: processed.slice(lastIndex, match.index) }))
    }

    if (match[0].startsWith('**')) {
      runs.push(new TextRun({ text: match[2], bold: true }))
    } else {
      runs.push(new TextRun({ text: match[3], italics: true }))
    }

    lastIndex = match.index + match[0].length
  }

  // 剩余文本
  if (lastIndex < processed.length) {
    runs.push(new TextRun({ text: processed.slice(lastIndex) }))
  }

  return runs.length > 0 ? runs : [new TextRun({ text: processed })]
}
