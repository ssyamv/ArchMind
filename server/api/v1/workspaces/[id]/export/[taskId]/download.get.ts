/**
 * GET /api/v1/workspaces/:id/export/:taskId/download
 * 下载导出的 ZIP 文件
 */

import * as path from 'path'
import * as fs from 'fs/promises'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const taskId = getRouterParam(event, 'taskId')

  if (!workspaceId || !taskId) {
    throw createError({ statusCode: 400, message: '参数缺失' })
  }

  await requireWorkspaceRole(event, workspaceId, 'workspace', 'read')

  // 构建文件路径
  const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.tmp')
  const zipPath = path.join(tmpDir, `export-${taskId}.zip`)

  try {
    const zipBuffer = await fs.readFile(zipPath)

    // 设置响应头
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', `attachment; filename="workspace-export-${new Date().toISOString().split('T')[0]}.zip"`)
    setHeader(event, 'Content-Length', zipBuffer.length)

    // 下载后删除临时文件
    setImmediate(async () => {
      try {
        await fs.unlink(zipPath)
      } catch (e) {
        console.warn('[Export] 清理临时文件失败', e)
      }
    })

    return zipBuffer
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw createError({ statusCode: 404, message: '导出文件不存在或已过期' })
    }
    throw createError({ statusCode: 500, message: `下载失败：${err?.message}` })
  }
})
