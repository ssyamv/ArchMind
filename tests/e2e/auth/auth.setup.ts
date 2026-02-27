/**
 * 认证前置设置
 *
 * 注册测试用户并登录，将 Cookie 状态保存到 .auth/user.json
 * 后续测试直接复用已认证状态，避免每个测试都重复登录。
 */
import { test as setup, expect } from '@playwright/test'

const authFile = 'tests/e2e/.auth/user.json'

setup('authenticate', async ({ page, request }) => {
  const testEmail = `e2e-${Date.now()}@archmind.test`
  const testPassword = 'E2eTest@2026'
  const testUsername = `e2e_user_${Date.now()}`

  // 1. 注册测试用户
  const registerRes = await request.post('/api/v1/auth/register', {
    data: {
      email: testEmail,
      password: testPassword,
      username: testUsername,
      fullName: 'E2E Test User'
    },
    headers: {
      'Origin': process.env.BASE_URL || 'http://localhost:3000',
      'Referer': `${process.env.BASE_URL || 'http://localhost:3000'}/register`
    }
  })
  // 注册必须成功（200），否则无法登录
  expect(registerRes.status()).toBe(200)

  // 2. 直接通过 API 登录，获取 Cookie（比 UI 登录更稳定）
  const loginRes = await request.post('/api/v1/auth/login', {
    data: { email: testEmail, password: testPassword },
    headers: {
      'Origin': process.env.BASE_URL || 'http://localhost:3000',
      'Referer': `${process.env.BASE_URL || 'http://localhost:3000'}/login`
    }
  })
  expect(loginRes.status()).toBe(200)

  // 3. 保存认证状态（Cookie 已由 API 响应的 Set-Cookie 写入上下文）
  await page.context().storageState({ path: authFile })
})
