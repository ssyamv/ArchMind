/**
 * POST /api/v1/workspaces/:id/export
 * 触发工作区数据导出（异步任务）
 */

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { WorkspaceExporter } from '~/lib/export/workspace-exporter'
import { dbClient } from '~/lib/db/client'

const Schema = z.object({
  includeDocuments: z.boolean().default(true),
  includePRDs: z.boolean().default(true),
  includePrototypes: z.boolean().default(true),
  includeOriginalFiles: z.boolean().default(false),
  includeSnapshots: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) throw createError({ statusCode: 400, message: 'workspaceId 必填' })

  const body = await readValidatedBody(event, Schema.parse)
  await requireWorkspaceRole(event, workspaceId, 'workspace', 'read')

  // 获取工作区名称
  const workspace = await dbClient.query<{ name: string }>(
    'SELECT name FROM workspaces WHERE id = $1',
    [workspaceId]
  )
  if (workspace.rows.length === 0) {
    throw createError({ statusCode: 404, message: '工作区不存在' })
  }

  const exporter = new WorkspaceExporter()

  try {
    // 执行导出（同步，简化版本）
    const zipPath = await exporter.export({
      workspaceId,
      workspaceName: workspace.rows[0].name,
      ...body,
    })

    // 返回任务 ID（实际是文件路径的 basename）
    const taskId = zipPath.split('/').pop()?.replace('.zip', '') || randomUUID()

    return {
      success: true,
      data: {
        taskId,
        status: 'completed',
        progress: 100,
      },
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: `导出失败：${err?.message}` })
  }
})
