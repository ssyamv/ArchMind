/**
 * E2E 测试：Onboarding 引导流程（P1）
 * 覆盖：新用户首次登录看到欢迎页 → 开始引导 → 完成/跳过
 *
 * NOTE: 这些测试依赖 registerNewUser（完整注册流程），
 * 在 CI 环境中暂时跳过，待 seed 机制完善后启用。
 */

import { test, expect } from '@playwright/test'
import { registerNewUser } from './helpers/auth'

test.describe.skip('Onboarding 引导流程', () => {
  test('新用户注册后看到欢迎页', async ({ page }) => {
    const uniqueEmail = `onboarding-${Date.now()}@e2e.test`

    await registerNewUser(page, uniqueEmail)

    // 新用户应看到欢迎页
    const welcomeScreen = page.locator('[data-testid="welcome-screen"]')
    await expect(welcomeScreen).toBeVisible({ timeout: 10_000 })
  })

  test('可以跳过欢迎引导', async ({ page }) => {
    const uniqueEmail = `skip-onboarding-${Date.now()}@e2e.test`

    await registerNewUser(page, uniqueEmail)

    // 等待欢迎页
    await expect(page.locator('[data-testid="welcome-screen"]')).toBeVisible({ timeout: 10_000 })

    // 点击跳过
    const skipBtn = page.locator('[data-testid="welcome-skip"]')
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()

    // 欢迎页消失，进入正常应用界面
    await expect(page.locator('[data-testid="welcome-screen"]')).not.toBeVisible({ timeout: 5_000 })
  })

  test('可以开始引导流程', async ({ page }) => {
    const uniqueEmail = `start-onboarding-${Date.now()}@e2e.test`

    await registerNewUser(page, uniqueEmail)

    // 等待欢迎页
    await expect(page.locator('[data-testid="welcome-screen"]')).toBeVisible({ timeout: 10_000 })

    // 点击开始引导
    const startBtn = page.locator('[data-testid="welcome-start"]')
    if (await startBtn.isVisible()) {
      await startBtn.click()
      // 应该出现 Setup Wizard Dialog
      await expect(page.locator('[data-testid="setup-wizard"]')).toBeVisible({ timeout: 5_000 })
    }
  })
})
