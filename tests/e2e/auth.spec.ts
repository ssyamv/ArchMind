/**
 * E2E 测试：认证流程（P0）
 * 覆盖：注册 → 登录 → 登出
 */

import { test, expect } from '@playwright/test'
import { TEST_USER } from './fixtures/test-user'

test.describe('认证流程', () => {
  // 注册完整流程需要完整后端环境（存储、邮件等），在 CI 中跳过
  test.skip('用户注册 → 登录 → 登出完整流程', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@e2e.test`

    // 1. 访问注册页
    await page.goto('/register')
    await expect(page).toHaveTitle(/ArchMind|注册/)

    await page.fill('[data-testid="email"]', uniqueEmail)
    await page.fill('[data-testid="password"]', 'Test1234!')
    await page.click('[data-testid="register-submit"]')

    // 2. 注册成功后跳转到 /app（新用户看到 Onboarding 欢迎页）
    await page.waitForURL('/app', { timeout: 15_000 })
    await expect(page.locator('[data-testid="welcome-screen"]')).toBeVisible()

    // 3. 跳过 Onboarding
    const skipBtn = page.locator('[data-testid="welcome-skip"]')
    if (await skipBtn.isVisible()) {
      await skipBtn.click()
    }

    // 4. 登出
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout"]')
    await page.waitForURL('/login', { timeout: 10_000 })
  })

  // 使用预置测试账号登录，需要提前在 DB 中 seed 数据，CI 暂跳过
  test.skip('使用已有账号登录', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[data-testid="email"]', TEST_USER.email)
    await page.fill('[data-testid="password"]', TEST_USER.password)
    await page.click('[data-testid="login-submit"]')

    // 登录成功后跳转到应用
    await page.waitForURL(/\/(app|generate)/, { timeout: 15_000 })
  })

  // 需要后端 login API 正常工作且返回 401，CI 中暂跳过
  test.skip('密码错误时显示错误提示', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[data-testid="email"]', 'nonexistent@e2e.test')
    await page.fill('[data-testid="password"]', 'WrongPassword!')
    await page.click('[data-testid="login-submit"]')

    // 停留在登录页并显示错误
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('未登录用户访问受保护页面重定向到登录页', async ({ page }) => {
    await page.goto('/generate')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })
})
