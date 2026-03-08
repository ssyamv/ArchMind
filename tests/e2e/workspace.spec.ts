/**
 * E2E 测试：工作区管理（P1）
 * 覆盖：查看工作区列表、访问工作区设置
 */

import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('工作区管理', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('用户登录后有默认工作区', async ({ page }) => {
    await page.goto('/app')

    // 侧边栏应显示工作区名称
    const workspaceSelector = page.locator('[data-testid="workspace-name"]')
    await expect(workspaceSelector).toBeVisible({ timeout: 10_000 })
  })

  test('访问工作区设置页面', async ({ page }) => {
    await page.goto('/workspace')

    // 页面应有工作区设置内容
    await expect(page).toHaveURL(/\/workspace/)
    const content = page.locator('main, [data-testid="workspace-settings"]')
    await expect(content).toBeVisible({ timeout: 10_000 })
  })

  test('用户个人设置页面可访问', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)

    const content = page.locator('main, [data-testid="profile-page"]')
    await expect(content).toBeVisible({ timeout: 10_000 })
  })
})
