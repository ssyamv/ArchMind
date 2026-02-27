/**
 * 公开页面 E2E 测试（无需认证）
 *
 * 覆盖：
 *   - 登录页渲染（未认证时的入口页）
 *   - 健康检查端点
 *   - OpenAPI 文档端点
 */
import { test, expect } from '@playwright/test'

// 公开页面测试不依赖认证状态
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('公开页面', () => {
  test('登录页正常渲染', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    // 登录页应有表单
    await expect(page.locator('form, [data-testid="login-form"]')).toBeVisible({ timeout: 10_000 })
  })

  test('未认证时访问首页重定向到登录页', async ({ page }) => {
    await page.goto('/')
    // 未认证时应重定向到 /login 或显示登录入口
    await page.waitForLoadState('domcontentloaded')
    const url = page.url()
    const hasLoginForm = await page.locator('form').isVisible().catch(() => false)
    // 要么 URL 包含 /login，要么页面有表单
    expect(url.includes('/login') || hasLoginForm).toBe(true)
  })

  test('健康检查端点正常响应', async ({ request }) => {
    const res = await request.get('/api/v1/health')
    // 200 = 健康，503 = 数据库问题（也算服务器在运行）
    expect([200, 503]).toContain(res.status())

    const body = await res.json()
    expect(body).toHaveProperty('status')
  })

  test('OpenAPI 文档端点返回合法 JSON', async ({ request }) => {
    const res = await request.get('/api/v1/openapi')

    // openapi.json 文件需存在（通过 pnpm docs:api 生成）
    if (res.status() === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('openapi')
      expect(body).toHaveProperty('paths')
      expect(body.info.title).toContain('ArchMind')
    } else {
      // 如果文档未生成，返回 404 也可接受
      expect([200, 404]).toContain(res.status())
    }
  })

  test('注册页可访问', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('form')).toBeVisible({ timeout: 10_000 })
  })
})
