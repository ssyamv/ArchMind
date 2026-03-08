/**
 * E2E 测试：PRD 生成流程（P0）
 * 覆盖：选择模板 → 填写需求 → 流式生成 → 保存
 */

import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('PRD 生成流程', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('访问 PRD 生成页面', async ({ page }) => {
    await page.goto('/generate')
    await expect(page).toHaveURL(/\/generate/)

    // 页面应包含 PRD 相关元素
    const hasInput = await page.locator('[data-testid="prd-input"]').isVisible({ timeout: 10_000 })
    expect(hasInput).toBe(true)
  })

  test('填写需求文字并触发生成', async ({ page }) => {
    await page.goto('/generate?new=1')

    // 等待页面加载完成
    const prdInput = page.locator('[data-testid="prd-input"]')
    await expect(prdInput).toBeVisible({ timeout: 10_000 })

    // 填写 PRD 需求
    await prdInput.fill('用户登录功能，支持邮箱密码登录，需要有找回密码功能')

    // 点击生成按钮
    const generateBtn = page.locator('[data-testid="generate-prd"]')
    await expect(generateBtn).toBeVisible()
    await generateBtn.click()

    // 等待流式输出完成（最多 60s，AI 生成可能较慢）
    await expect(page.locator('[data-testid="prd-complete"]')).toBeVisible({ timeout: 60_000 })

    // 验证 PRD 内容非空
    const content = await page.locator('[data-testid="prd-content"]').textContent()
    expect(content?.length).toBeGreaterThan(100)
  })

  test('PRD 列表页面可访问', async ({ page }) => {
    await page.goto('/prd')
    await expect(page).toHaveURL(/\/prd/)

    const hasContent = await page.locator('[data-testid="prd-list"], [data-testid="empty-state-prd"]').isVisible({ timeout: 10_000 })
    expect(hasContent).toBe(true)
  })
})
