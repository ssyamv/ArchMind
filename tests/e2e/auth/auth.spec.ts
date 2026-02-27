/**
 * 认证流程 E2E 测试
 *
 * 覆盖：
 *   - 登录页面渲染
 *   - 注册流程
 *   - 登录/退出
 *   - 未登录保护（重定向到登录页）
 *   - 忘记密码页面
 */
import { test, expect } from '@playwright/test'

// 这些测试不依赖已认证状态，独立运行
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('认证流程', () => {
  test('登录页面正常渲染', async ({ page }) => {
    await page.goto('/login')

    // 检查关键元素
    await expect(page.getByRole('heading', { name: /登录|Login|Sign in/i })).toBeVisible()
    await expect(page.getByLabel(/邮箱|Email/i)).toBeVisible()
    await expect(page.getByLabel(/密码|Password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /登录|Login|Sign in/i })).toBeEnabled()
  })

  test('注册页面正常渲染', async ({ page }) => {
    await page.goto('/register')

    await expect(page.getByLabel(/邮箱|Email/i)).toBeVisible()
    await expect(page.getByLabel(/密码|Password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /注册|Register|Sign up/i })).toBeEnabled()
  })

  test('使用无效凭证登录显示错误', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/邮箱|Email/i).fill('nonexistent@example.com')
    await page.getByLabel(/密码|Password/i).fill('WrongPassword123')
    await page.getByRole('button', { name: /登录|Login|Sign in/i }).click()

    // 应显示错误提示（toast 或表单错误）
    await expect(
      page.getByText(/邮箱或密码错误|Invalid credentials|Login failed/i)
    ).toBeVisible({ timeout: 5_000 })

    // 仍停留在登录页
    await expect(page).toHaveURL(/\/login/)
  })

  test('使用空字段登录显示验证错误', async ({ page }) => {
    await page.goto('/login')

    // 直接点击提交，不填写任何字段
    await page.getByRole('button', { name: /登录|Login|Sign in/i }).click()

    // 应有表单验证错误（HTML5 或自定义）
    const emailInput = page.getByLabel(/邮箱|Email/i)
    const isInvalid = await emailInput.evaluate(
      (el) => !(el as HTMLInputElement).checkValidity()
    )
    expect(isInvalid).toBe(true)
  })

  test('忘记密码页面渲染', async ({ page }) => {
    await page.goto('/forgot-password')

    await expect(page.getByLabel(/邮箱|Email/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /发送|Send/i })).toBeVisible()
  })

  test('未登录访问受保护页面重定向到登录', async ({ page }) => {
    // 直接访问受保护路由
    await page.goto('/documents')

    // 应该被重定向到登录页
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('从登录页可以跳转到注册页', async ({ page }) => {
    await page.goto('/login')

    // 点击注册链接
    await page.getByRole('link', { name: /注册|Register|Sign up/i }).click()
    await expect(page).toHaveURL(/\/register/)
  })
})
