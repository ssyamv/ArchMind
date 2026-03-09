/**
 * E2E 测试：文档上传流程（P1）
 * 覆盖：文档列表 → 上传 → 处理完成 → 删除
 *
 * NOTE: 这些测试需要预置登录用户（loginAsTestUser），
 * 在 CI 环境中暂时跳过，待 seed 机制完善后启用。
 */

import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

test.describe.skip('文档管理', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('访问文档列表页', async ({ page }) => {
    await page.goto('/documents')
    await expect(page).toHaveURL(/\/documents/)

    // 页面应包含文档列表容器或空状态
    const hasContent = await page.locator('[data-testid="document-list"], [data-testid="empty-state-document"]').isVisible()
    expect(hasContent).toBe(true)
  })

  test('上传文本文件并等待处理', async ({ page }) => {
    // 创建临时测试文件
    const tmpFile = path.join(os.tmpdir(), `e2e-test-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, '# 测试文档\n\n这是一个用于 E2E 测试的文档内容。\n\n## 功能描述\n\n用户登录功能需要支持邮箱和密码方式。')

    try {
      await page.goto('/documents')

      // 点击上传按钮
      const uploadBtn = page.locator('[data-testid="upload-document"]')
      await expect(uploadBtn).toBeVisible({ timeout: 10_000 })
      await uploadBtn.click()

      // 上传文件
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(tmpFile)

      // 等待上传成功提示或文档出现在列表中
      await expect(
        page.locator('[data-testid="upload-success"], [data-testid="document-item"]').first()
      ).toBeVisible({ timeout: 30_000 })
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })
})
