/**
 * POST /api/v1/workspaces/:id/import/:taskId/confirm
 * 确认并执行导入
 */

import { z } from 'zod'
import * as path from 'path'
import * as fs from 'fs/promises'
import { WorkspaceImporter } from '~/lib/import/workspace-importer'

const Schema = z.object({
  strategy: z.enum(['skip', 'overwrite', 'rename']).default('skip'),
})

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const taskId = getRouterParam(event, 'taskId')

  if (!workspaceId || !taskId) {
    throw createError({ statusCode: 400, message: '参数缺失' })
  }

  const body = await readValidatedBody(event, Schema.parse)
  const { userId } = await requireWorkspaceRole(event, workspaceId, 'workspace', 'write')

  const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.tmp')
  const zipPath = path.join(tmpDir, `import-${taskId}.zip`)

  const importer = new WorkspaceImporter()
  try {
    const result = await importer.execute(zipPath, workspaceId, userId, body.strategy)

    // 清理临时文件
    setImmediate(async () => {
      try {
        await fs.unlink(zipPath)
      } catch (e) {
        console.warn('[Import] 清理临时文件失败', e)
      }
    })

    return { success: true, data: result }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: `导入失败：${err?.message}` })
  }
})
