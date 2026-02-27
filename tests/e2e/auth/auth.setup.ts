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
    }
  })
  // 允许 400（用户已存在）或 200（注册成功）
  expect([200, 201, 400]).toContain(registerRes.status())

  // 2. 访问登录页
  await page.goto('/login')
  await expect(page.locator('form')).toBeVisible()

  // 3. 填写登录表单
  await page.getByLabel(/邮箱|Email/i).fill(testEmail)
  await page.getByLabel(/密码|Password/i).fill(testPassword)
  await page.getByRole('button', { name: /登录|Login|Sign in/i }).click()

  // 4. 等待登录成功，跳转到工作区或首页
  await page.waitForURL(/\/(workspace|documents|generate|projects)/, { timeout: 15_000 })

  // 5. 保存认证状态（Cookie）
  await page.context().storageState({ path: authFile })
})
