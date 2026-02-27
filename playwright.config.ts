import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 测试配置
 *
 * 覆盖核心用户流程：
 *   - 认证流程（注册、登录、退出）
 *   - 文档上传与管理
 *   - PRD 生成
 *   - 工作区管理
 *
 * 运行方式：
 *   pnpm test:e2e              # 运行所有 E2E 测试
 *   pnpm test:e2e --ui         # 打开 Playwright UI
 *   pnpm test:e2e --headed     # 显示浏览器
 *   pnpm test:e2e auth         # 只运行 auth 测试
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  // 最大并发 worker 数（CI 环境单线程防止资源冲突）
  fullyParallel: !process.env.CI,
  workers: process.env.CI ? 1 : undefined,

  // CI 环境禁止 retry（本地开发 retry 1 次）
  retries: process.env.CI ? 0 : 1,

  // 测试失败时的报告器
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(process.env.CI ? [['github'] as [string]] : [])
  ],

  // 全局超时
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    // 测试服务器地址
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // 请求失败时截图
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'off',

    // 忽略 HTTPS 证书错误（本地开发）
    ignoreHTTPSErrors: true
  },

  projects: [
    // ─── 认证前置：注册 + 登录，生成认证 state ────────────────────────────────
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      use: { ...devices['Desktop Chrome'] }
    },

    // ─── 主流程测试（依赖已认证 state）──────────────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json'
      },
      dependencies: ['setup']
    },

    // ─── 公开页面测试（无需认证）─────────────────────────────────────────────────
    {
      name: 'public',
      testMatch: '**/public/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  // 自动启动 Nuxt 开发服务器（仅本地，CI 中由 workflow 启动）
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000
      }
})
