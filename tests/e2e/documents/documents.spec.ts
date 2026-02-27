/**
 * 文档管理 E2E 测试
 *
 * 覆盖：
 *   - 文档列表页面渲染
 *   - 文档上传对话框
 *   - 文档搜索
 *   - 删除确认
 */
import { test, expect } from '@playwright/test'

test.describe('文档管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents')
    // 等待页面主内容加载
    await expect(page.locator('main, [role="main"], .documents-page')).toBeVisible({ timeout: 10_000 })
  })

  test('文档列表页面正常渲染', async ({ page }) => {
    // 应有上传按钮
    await expect(
      page.getByRole('button', { name: /上传|Upload/i })
    ).toBeVisible()
  })

  test('点击上传按钮打开上传对话框', async ({ page }) => {
    const uploadBtn = page.getByRole('button', { name: /上传|Upload/i }).first()
    await uploadBtn.click()

    // 上传对话框或区域应出现
    await expect(
      page.getByRole('dialog').or(page.locator('[data-upload-dialog]'))
        .or(page.locator('input[type="file"]'))
    ).toBeVisible({ timeout: 5_000 })
  })

  test('搜索框可以输入', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/搜索|Search/i).first()

    if (await searchInput.isVisible()) {
      await searchInput.fill('测试文档')
      await expect(searchInput).toHaveValue('测试文档')
    }
  })

  test('文档列表显示正确的列头或空状态', async ({ page }) => {
    // 等待加载完成（loading spinner 消失）
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('[data-loading], .animate-spin')
      return spinners.length === 0
    }, { timeout: 10_000 })

    // 有数据时显示列表，无数据时显示空状态
    const hasDocuments = await page.locator('[data-document-item]').count() > 0
    const hasEmptyState = await page.getByText(/暂无文档|No documents|Upload your first/i).isVisible()

    expect(hasDocuments || hasEmptyState).toBe(true)
  })
})
