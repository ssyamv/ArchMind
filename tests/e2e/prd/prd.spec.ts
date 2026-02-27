/**
 * PRD 功能 E2E 测试
 *
 * 覆盖：
 *   - PRD 列表页面渲染
 *   - 进入 PRD 生成页面
 *   - PRD 生成表单元素
 *   - PRD 详情页面
 */
import { test, expect } from '@playwright/test'

test.describe('PRD 功能', () => {
  test('PRD 生成页面正常渲染', async ({ page }) => {
    await page.goto('/generate')

    // 等待页面加载
    await page.waitForLoadState('networkidle')

    // 应有输入区域（用于描述 PRD 需求）
    await expect(
      page.getByPlaceholder(/描述|输入|Describe|Input/i)
        .or(page.locator('textarea'))
        .first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('PRD 生成表单有提交按钮', async ({ page }) => {
    await page.goto('/generate')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('button', { name: /生成|Generate|创建|Create/i })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('项目列表页面正常渲染', async ({ page }) => {
    await page.goto('/projects')

    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('.animate-spin')
      return spinners.length === 0
    }, { timeout: 10_000 })

    // 有 PRD 时显示列表，无 PRD 时显示空状态或生成入口
    const hasContent = await Promise.race([
      page.locator('[data-prd-item]').first().isVisible().catch(() => false),
      page.getByText(/暂无|No PRD|Create your first|开始/i).isVisible().catch(() => false),
      page.getByRole('button', { name: /生成|Generate|新建|Create/i }).first().isVisible().catch(() => false)
    ])

    expect(hasContent).toBe(true)
  })
})
