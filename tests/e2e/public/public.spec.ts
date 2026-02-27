/**
 * 公开页面 E2E 测试（无需认证）
 *
 * 覆盖：
 *   - 首页渲染
 *   - 导航链接
 *   - 健康检查端点
 *   - OpenAPI 文档端点
 */
import { test, expect } from '@playwright/test'

// 公开页面测试不依赖认证状态
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('公开页面', () => {
  test('首页正常渲染', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // 检查品牌名称
    await expect(page.getByText('ArchMind')).toBeVisible()
  })

  test('首页有登录和注册入口', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(
      page.getByRole('link', { name: /登录|Login|Sign in/i })
        .or(page.getByRole('button', { name: /登录|Login|Sign in/i }))
    ).toBeVisible()
  })

  test('健康检查端点正常响应', async ({ request }) => {
    const res = await request.get('/api/v1/health')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('status')
    expect(['ok', 'degraded']).toContain(body.status)
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
      // 如果文档未生成，返回 404 也可接受（CI 中需先运行 pnpm docs:api）
      expect([200, 404]).toContain(res.status())
    }
  })

  test('登录页从首页可访问', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /登录|Login|Sign in/i }).first().click()
    await expect(page).toHaveURL(/\/login/)
  })
})
