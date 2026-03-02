/**
 * PrototypeGenerator.parseMultiPageOutput 单元测试（#55）
 * 覆盖 4 种解析层级
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

// mock 依赖，防止加载数据库和 AI 模块
vi.mock('~/lib/ai/manager', () => ({
  ModelManager: vi.fn().mockImplementation(function (this: any) {
    this.getAdapter = () => null
    this.estimateCost = () => null
    this.getAvailableModels = () => []
  })
}))

vi.mock('~/lib/rag/retriever', () => ({
  RAGRetriever: vi.fn().mockImplementation(function (this: any) {
    this.retrieve = async () => []
    this.summarizeResults = () => ''
  })
}))

import { PrototypeGenerator } from '~/lib/prototype/generator'

// 辅助函数：生成合法的 HTML 页面字符串
function makePage (title: string, h1: string, body = '内容'): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${title}</title>
</head>
<body>
<h1>${h1}</h1>
<p>${body}</p>
</body>
</html>`
}

describe('PrototypeGenerator.parseMultiPageOutput', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────
  // 层级 1：标准 PAGE 标记
  // ─────────────────────────────────────────────────────────────
  describe('层级 1：PAGE 标记解析', () => {
    it('标准标记：解析 2 个页面', () => {
      const output = `<!-- PAGE:home:首页 -->
${makePage('首页', '欢迎')}
<!-- PAGE:login:登录页 -->
${makePage('登录', '请登录')}`

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(2)
      expect(pages[0].pageSlug).toBe('home')
      expect(pages[0].pageName).toBe('首页')
      expect(pages[1].pageSlug).toBe('login')
      expect(pages[1].pageName).toBe('登录页')
    })

    it('容错大小写：PAGE 大小写混用仍能解析', () => {
      const output = `<!-- page:dashboard:数据面板 -->
${makePage('数据面板', 'Dashboard')}`

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(1)
      expect(pages[0].pageSlug).toBe('dashboard')
      expect(pages[0].pageName).toBe('数据面板')
    })

    it('容错多余空格：标记中有多余空格仍能解析', () => {
      const output = `<!--  PAGE  :  settings  :  设置页  -->
${makePage('设置', '设置')}`

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(1)
      expect(pages[0].pageSlug).toBe('settings')
      expect(pages[0].pageName).toBe('设置页')
    })

    it('标记内容含代码块包裹时去除代码块标记', () => {
      const pageHtml = makePage('首页', '欢迎')
      const output = `<!-- PAGE:home:首页 -->
\`\`\`html
${pageHtml}
\`\`\``

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(1)
      expect(pages[0].htmlContent).toContain('<!DOCTYPE html>')
      expect(pages[0].htmlContent).not.toContain('```')
    })

    it('slug 含连字符的页面正确解析', () => {
      const output = `<!-- PAGE:user-profile:用户资料 -->
${makePage('用户资料', '个人信息')}`

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(1)
      expect(pages[0].pageSlug).toBe('user-profile')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 层级 2：HTML 文档边界拆分
  // ─────────────────────────────────────────────────────────────
  describe('层级 2：HTML 文档边界拆分', () => {
    it('多个 <!DOCTYPE html> 分隔的文档正确拆分', () => {
      const output = makePage('首页', '欢迎首页') + '\n\n' + makePage('登录页', '请登录')

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(2)
    })

    it('slug 由 <title> 转 kebab-case 生成', () => {
      const page = `<!DOCTYPE html>
<html>
<head><title>User Profile</title></head>
<body><h1>用户资料</h1></body>
</html>`

      const pages = PrototypeGenerator.parseMultiPageOutput(page + '\n\n' + page)
      expect(pages[0].pageSlug).toBe('user-profile')
    })

    it('名称优先取 <h1>，无 h1 时取 <title>', () => {
      const withH1 = `<!DOCTYPE html>
<html>
<head><title>标题</title></head>
<body><h1>真实名称</h1></body>
</html>`
      const withoutH1 = `<!DOCTYPE html>
<html>
<head><title>仅标题</title></head>
<body><p>无h1内容</p></body>
</html>`

      const pages = PrototypeGenerator.parseMultiPageOutput(withH1 + '\n\n' + withoutH1)
      expect(pages[0].pageName).toBe('真实名称')
      expect(pages[1].pageName).toBe('仅标题')
    })

    it('无 title 和 h1 时，名称补全为 页面 N', () => {
      const bare = `<!DOCTYPE html>
<html>
<head></head>
<body><p>内容</p></body>
</html>`

      const pages = PrototypeGenerator.parseMultiPageOutput(bare + '\n\n' + bare)
      expect(pages[0].pageName).toBe('页面 1')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 层级 3：```html 代码块提取
  // ─────────────────────────────────────────────────────────────
  describe('层级 3：代码块提取', () => {
    it('多个 ```html 代码块各生成一个页面（不含 DOCTYPE，层级 2 不能识别）', () => {
      // 不用 makePage（含 DOCTYPE），改用无 DOCTYPE 的 HTML 片段
      const frag1 = '<div><h1>首页</h1></div>'
      const frag2 = '<div><h1>关于</h1></div>'
      const output = `以下是两个页面：

\`\`\`html
${frag1}
\`\`\`

\`\`\`html
${frag2}
\`\`\``

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(2)
      expect(pages[0].pageSlug).toBe('page-1')
      expect(pages[0].pageName).toBe('页面 1')
      expect(pages[1].pageSlug).toBe('page-2')
      expect(pages[1].pageName).toBe('页面 2')
    })

    it('单个代码块生成 page-1（不含 DOCTYPE）', () => {
      const output = `\`\`\`html
<div><h1>单页内容</h1></div>
\`\`\``

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(1)
      expect(pages[0].pageSlug).toBe('page-1')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 层级 4：兜底单页面
  // ─────────────────────────────────────────────────────────────
  describe('层级 4：兜底单页面', () => {
    it('完整 HTML 文档（无标记/无代码块）兜底为 main/主页面', () => {
      const output = makePage('唯一页', '仅此一页')

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(1)
      expect(pages[0].pageSlug).toBe('main')
      expect(pages[0].pageName).toBe('主页面')
    })

    it('纯文本无 HTML 时仍返回 1 个页面', () => {
      const output = '这是一段没有 HTML 的文本内容'
      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages).toHaveLength(1)
      expect(pages[0].pageSlug).toBe('main')
    })

    it('空字符串返回空数组', () => {
      const pages = PrototypeGenerator.parseMultiPageOutput('')
      expect(pages).toHaveLength(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 优先级验证（层级 1 > 层级 2 > 层级 3 > 层级 4）
  // ─────────────────────────────────────────────────────────────
  describe('降级优先级', () => {
    it('同时有 PAGE 标记和多 DOCTYPE 时，优先使用层级 1', () => {
      const output = `<!-- PAGE:home:首页 -->
${makePage('首页', '欢迎')}
<!-- PAGE:about:关于 -->
${makePage('关于', '关于我们')}`

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      // 层级 1 结果：slug 直接来自标记
      expect(pages[0].pageSlug).toBe('home')
      expect(pages[1].pageSlug).toBe('about')
    })

    it('有代码块和完整 HTML 文档时，代码块优先（层级 3 > 层级 4）', () => {
      const output = `这里有一些文本
\`\`\`html
${makePage('代码块页面', '来自代码块')}
\`\`\`
这里还有文本`

      const pages = PrototypeGenerator.parseMultiPageOutput(output)
      expect(pages[0].pageSlug).toBe('page-1')
    })
  })
})
