/**
 * PRD Few-shot 示例库单元测试（#51）
 * 验证三维匹配算法：行业关键词、功能动词、Jaccard 相似度
 */

import { describe, it, expect } from 'vitest'
import { PRD_EXAMPLES, selectRelevantExamples } from '~/lib/ai/prompts/prd-examples'

describe('PRD_EXAMPLES - 示例库基础', () => {
  it('示例库包含 10 个以上不同行业示例', () => {
    expect(PRD_EXAMPLES.length).toBeGreaterThanOrEqual(10)
  })

  it('每个示例都有必要字段', () => {
    for (const ex of PRD_EXAMPLES) {
      expect(ex.userInput).toBeTruthy()
      expect(ex.context).toBeTruthy()
      expect(ex.prdOutput).toBeTruthy()
      expect(['feature', 'optimization']).toContain(ex.category)
    }
  })

  it('每个示例 prdOutput 都包含 KPI 相关内容（成功指标）', () => {
    for (const ex of PRD_EXAMPLES) {
      // 验证示例符合高质量PRD格式
      expect(ex.prdOutput).toContain('成功指标')
    }
  })

  it('新增的 7 个示例 category 均为 feature', () => {
    // 示例 #04-#10
    const newExamples = PRD_EXAMPLES.slice(3)
    for (const ex of newExamples) {
      expect(ex.category).toBe('feature')
    }
  })
})

describe('selectRelevantExamples - 三维匹配算法', () => {
  describe('行业关键词匹配（维度1，权重0.5）', () => {
    it('SaaS 企业/B2B 查询应命中 RBAC 权限示例', () => {
      const results = selectRelevantExamples('为 SaaS 企业设计用户权限管理系统', 3)
      const slugs = results.map(r => r.userInput)
      // RBAC 示例包含 SaaS、企业、权限等关键词，应排在前面
      const hasRBAC = slugs.some(s => s.includes('RBAC') || s.includes('权限管理'))
      expect(hasRBAC).toBe(true)
    })

    it('教育/学习 查询应命中在线学习进度示例', () => {
      const results = selectRelevantExamples('为在线学习平台设计证书发放功能', 3)
      const hasEducation = results.some(r => r.userInput.includes('在线学习') || r.userInput.includes('证书'))
      expect(hasEducation).toBe(true)
    })

    it('健康/医疗 查询应命中健康看板示例', () => {
      const results = selectRelevantExamples('健康 App 数据看板设计', 3)
      const hasHealth = results.some(r => r.userInput.includes('健康 App') || r.userInput.includes('健康数据'))
      expect(hasHealth).toBe(true)
    })

    it('金融/记账 查询应命中账单分析示例', () => {
      const results = selectRelevantExamples('个人记账 App 账单智能分类', 3)
      const hasFinance = results.some(r => r.userInput.includes('记账') || r.userInput.includes('账单'))
      expect(hasFinance).toBe(true)
    })

    it('社区/创作者 查询应命中激励体系示例', () => {
      const results = selectRelevantExamples('内容社区创作者打赏激励设计', 3)
      const hasCommunity = results.some(r => r.userInput.includes('内容社区') || r.userInput.includes('创作者'))
      expect(hasCommunity).toBe(true)
    })

    it('工具/批量操作 查询应命中数据导入导出示例', () => {
      const results = selectRelevantExamples('工具软件数据批量导入导出 Excel', 3)
      const hasTools = results.some(r => r.userInput.includes('工具软件') || r.userInput.includes('导入导出'))
      expect(hasTools).toBe(true)
    })

    it('政务/审批 查询应命中审批流程引擎示例', () => {
      const results = selectRelevantExamples('企业内部审批流程引擎设计', 3)
      const hasGov = results.some(r => r.userInput.includes('审批流程') || r.userInput.includes('政务'))
      expect(hasGov).toBe(true)
    })
  })

  describe('默认参数', () => {
    it('默认返回 2 个示例', () => {
      const results = selectRelevantExamples('用户登录注册功能')
      expect(results).toHaveLength(2)
    })

    it('可自定义返回数量', () => {
      const results = selectRelevantExamples('功能设计', 3)
      expect(results).toHaveLength(3)
    })

    it('count 超过示例总数时返回所有示例', () => {
      const results = selectRelevantExamples('功能', 20)
      expect(results).toHaveLength(PRD_EXAMPLES.length)
    })
  })

  describe('评分合理性', () => {
    it('电商相关查询：积分/推荐示例应高于政务示例', () => {
      const allScored = PRD_EXAMPLES.map(ex => ({
        ex,
        // 通过取 top-1 验证排序合理性
      }))

      const top1 = selectRelevantExamples('电商 App 积分功能设计', 1)[0]
      // 电商积分示例应排第一
      expect(top1.userInput).toContain('积分')
    })

    it('优化类查询：性能优化示例应被选中', () => {
      const results = selectRelevantExamples('搜索性能优化，响应时间从800ms降至200ms', 2)
      const hasOptimization = results.some(r => r.category === 'optimization')
      expect(hasOptimization).toBe(true)
    })
  })

  describe('边界情况', () => {
    it('空字符串查询不抛出错误', () => {
      expect(() => selectRelevantExamples('')).not.toThrow()
    })

    it('特殊字符查询不抛出错误', () => {
      expect(() => selectRelevantExamples('!@#$%^&*()')).not.toThrow()
    })

    it('纯英文查询不抛出错误', () => {
      const results = selectRelevantExamples('user authentication login system')
      expect(results).toHaveLength(2)
    })
  })
})
