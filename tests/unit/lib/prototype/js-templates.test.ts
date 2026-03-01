/**
 * JS 模板库单元测试（#57）
 */

import { describe, it, expect } from 'vitest'
import { JS_TEMPLATES, buildJSTemplatePrompt } from '~/lib/prototype/js-templates'

describe('JS_TEMPLATES', () => {
  it('应包含 10 个模板', () => {
    expect(JS_TEMPLATES.length).toBe(10)
  })

  it('每个模板都有 name、description、code 三个字段', () => {
    for (const t of JS_TEMPLATES) {
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.code).toBeTruthy()
    }
  })

  it('包含所有预期模板名称', () => {
    const names = JS_TEMPLATES.map(t => t.name)
    expect(names).toContain('modal')
    expect(names).toContain('tabs')
    expect(names).toContain('dropdown')
    expect(names).toContain('form-validate')
    expect(names).toContain('toast')
    expect(names).toContain('accordion')
    expect(names).toContain('sidebar-toggle')
    expect(names).toContain('table-sort')
    expect(names).toContain('infinite-scroll')
    expect(names).toContain('search-filter')
  })

  describe('modal 模板', () => {
    it('使用 data-modal-open 属性作为触发钩子', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'modal')!
      expect(template.code).toContain('data-modal-open')
      expect(template.code).toContain('data-modal-close')
      expect(template.code).toContain('data-modal')
    })

    it('支持 ESC 关闭', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'modal')!
      expect(template.code).toContain('Escape')
    })
  })

  describe('tabs 模板', () => {
    it('使用 data-tab 和 data-tab-panel 属性', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'tabs')!
      expect(template.code).toContain('data-tab')
      expect(template.code).toContain('data-tab-panel')
      expect(template.code).toContain('data-tab-group')
    })

    it('初始化时激活第一个 tab', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'tabs')!
      expect(template.code).toContain('first.click()')
    })
  })

  describe('dropdown 模板', () => {
    it('点击外部时关闭', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'dropdown')!
      expect(template.code).toContain('stopPropagation')
      expect(template.code).toContain("document.addEventListener('click'")
    })
  })

  describe('form-validate 模板', () => {
    it('支持 email 格式校验', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'form-validate')!
      expect(template.code).toContain('email')
      expect(template.code).toContain('data-required')
    })

    it('使用 data-validate 作为表单标记', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'form-validate')!
      expect(template.code).toContain('data-validate')
    })
  })

  describe('toast 模板', () => {
    it('挂载到 window.showToast', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'toast')!
      expect(template.code).toContain('window.showToast')
    })

    it('支持 success、error、warning 三种类型', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'toast')!
      expect(template.code).toContain("'error'")
      expect(template.code).toContain("'warning'")
      expect(template.code).toContain('bg-green-500')
    })
  })

  describe('table-sort 模板', () => {
    it('使用 data-sortable 标记表格', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'table-sort')!
      expect(template.code).toContain('data-sortable')
      expect(template.code).toContain('data-sort')
    })

    it('支持升序和降序切换', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'table-sort')!
      expect(template.code).toContain('asc')
      expect(template.code).toContain('desc')
    })
  })

  describe('search-filter 模板', () => {
    it('使用 data-search-input 和 data-searchable 属性', () => {
      const template = JS_TEMPLATES.find(t => t.name === 'search-filter')!
      expect(template.code).toContain('data-search-input')
      expect(template.code).toContain('data-searchable')
    })
  })

  it('所有模板代码都不依赖外部库（不包含 import/require）', () => {
    for (const t of JS_TEMPLATES) {
      expect(t.code).not.toMatch(/\bimport\b/)
      expect(t.code).not.toMatch(/\brequire\b/)
    }
  })

  it('所有模板代码都不使用 Canvas API', () => {
    for (const t of JS_TEMPLATES) {
      expect(t.code).not.toContain('getContext')
      expect(t.code).not.toContain('<canvas')
    }
  })
})

describe('buildJSTemplatePrompt', () => {
  it('返回非空字符串', () => {
    const prompt = buildJSTemplatePrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('包含所有模板名称作为标题', () => {
    const prompt = buildJSTemplatePrompt()
    for (const t of JS_TEMPLATES) {
      expect(prompt).toContain(`### ${t.name}`)
    }
  })

  it('包含所有模板的描述', () => {
    const prompt = buildJSTemplatePrompt()
    for (const t of JS_TEMPLATES) {
      expect(prompt).toContain(t.description)
    }
  })

  it('包含所有模板的代码', () => {
    const prompt = buildJSTemplatePrompt()
    for (const t of JS_TEMPLATES) {
      // 取代码前50个字符验证
      expect(prompt).toContain(t.code.slice(0, 50))
    }
  })

  it('各模板之间用双换行分隔', () => {
    const prompt = buildJSTemplatePrompt()
    // 至少有 9 个分隔符（10个模板之间有9个间隔）
    const separators = prompt.split('\n\n').length - 1
    expect(separators).toBeGreaterThanOrEqual(9)
  })
})
