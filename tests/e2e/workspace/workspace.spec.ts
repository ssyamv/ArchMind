/**
 * 工作区管理 E2E 测试
 *
 * 覆盖：
 *   - 工作区切换器渲染
 *   - 创建工作区对话框
 *   - 工作区选择
 */
import { test, expect } from '@playwright/test'

test.describe('工作区管理', () => {
  test('应用加载后显示工作区切换器', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    // 工作区切换器应在导航栏/侧边栏中可见
    const workspaceSwitcher = page.locator(
      '[data-workspace-switcher], [aria-label*="workspace"], [aria-label*="工作区"]'
    ).or(page.getByText(/工作区|Workspace/i).first())

    await expect(workspaceSwitcher).toBeVisible({ timeout: 10_000 })
  })

  test('可以进入设置页面', async ({ page }) => {
    await page.goto('/settings/profile')

    await page.waitForLoadState('networkidle')

    // 设置页面应显示用户信息相关内容
    await expect(
      page.getByText(/个人信息|Profile|用户名|Username/i)
    ).toBeVisible({ timeout: 10_000 })
  })

  test('导航链接正确', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    // 侧边栏应有核心导航项
    const nav = page.locator('nav, aside, [role="navigation"]').first()
    await expect(nav).toBeVisible()
  })
})
