/**
 * 认证辅助函数
 * 提供快速登录能力，避免每个测试都重复完整的登录流程
 */

import type { Page } from '@playwright/test'
import { TEST_USER } from '../fixtures/test-user'

/**
 * 使用测试账号快速登录
 * 若账号不存在，先完成注册流程
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login')

  await page.fill('[data-testid="email"]', TEST_USER.email)
  await page.fill('[data-testid="password"]', TEST_USER.password)
  await page.click('[data-testid="login-submit"]')

  // 等待跳转到主应用页
  await page.waitForURL(/\/(app|dashboard|generate)/, { timeout: 15_000 })
}

/**
 * 注册新账号（用于需要全新账号的测试）
 */
export async function registerNewUser(
  page: Page,
  email: string,
  password: string = TEST_USER.password
): Promise<void> {
  await page.goto('/register')

  await page.fill('[data-testid="email"]', email)
  await page.fill('[data-testid="password"]', password)
  await page.click('[data-testid="register-submit"]')

  await page.waitForURL('/app', { timeout: 15_000 })
}
