/**
 * POST /api/v1/workspaces/:id/import
 * 上传并触发导入任务（第一步：分析冲突）
 */

import { randomUUID } from 'crypto'
import * as path from 'path'
import * as fs from 'fs/promises'
import { WorkspaceImporter } from '~/lib/import/workspace-importer'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) throw createError({ statusCode: 400, message: 'workspaceId 必填' })

  await requireWorkspaceRole(event, workspaceId, 'workspace', 'write')

  // 读取上传的文件
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: '未上传文件' })
  }

  const file = formData.find(f => f.name === 'file')
  if (!file || !file.data) {
    throw createError({ statusCode: 400, message: '文件字段缺失' })
  }

  // 保存到临时目录
  const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.tmp')
  await fs.mkdir(tmpDir, { recursive: true })

  const taskId = randomUUID()
  const zipPath = path.join(tmpDir, `import-${taskId}.zip`)
  await fs.writeFile(zipPath, file.data)

  // 分析冲突
  const importer = new WorkspaceImporter()
  try {
    const analysis = await importer.analyze(zipPath, workspaceId)

    return {
      success: true,
      data: {
        taskId,
        analysis,
      },
    }
  } catch (err: any) {
    // 清理临时文件
    await fs.unlink(zipPath).catch(() => {})
    throw createError({ statusCode: 400, message: `分析失败：${err?.message}` })
  }
})
