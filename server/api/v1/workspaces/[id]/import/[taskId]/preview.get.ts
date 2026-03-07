/**
 * GET /api/v1/workspaces/:id/import/:taskId/preview
 * 获取导入冲突预览
 */

import * as path from 'path'
import { WorkspaceImporter } from '~/lib/import/workspace-importer'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const taskId = getRouterParam(event, 'taskId')

  if (!workspaceId || !taskId) {
    throw createError({ statusCode: 400, message: '参数缺失' })
  }

  await requireWorkspaceRole(event, workspaceId, 'workspace', 'read')

  const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.tmp')
  const zipPath = path.join(tmpDir, `import-${taskId}.zip`)

  const importer = new WorkspaceImporter()
  try {
    const analysis = await importer.analyze(zipPath, workspaceId)
    return { success: true, data: analysis }
  } catch (err: any) {
    throw createError({ statusCode: 404, message: `预览失败：${err?.message}` })
  }
})
