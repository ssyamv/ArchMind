/**
 * POST /api/v1/prd/batch/export
 * 批量导出 PRD（返回 ZIP）
 */

import { z } from 'zod'
import JSZip from 'jszip'
import { PRDDAO } from '~/lib/db/dao/prd-dao'

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  workspaceId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Schema.parse)
  await requireWorkspaceRole(event, body.workspaceId, 'prd', 'read')

  // 批量查询 PRD
  const prdMap = await PRDDAO.findByIds(body.ids)
  const prds = body.ids
    .map(id => prdMap.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p && p.workspaceId === body.workspaceId)

  if (prds.length === 0) {
    throw createError({ statusCode: 404, message: '未找到可导出的 PRD' })
  }

  const zip = new JSZip()
  const index = prds.map(p => ({
    id: p.id,
    title: p.title,
    status: p.status,
    modelUsed: p.modelUsed,
    createdAt: p.createdAt,
  }))

  zip.file('index.json', JSON.stringify(index, null, 2))

  for (const prd of prds) {
    const safeTitle = prd.title.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 50)
    zip.file(`${prd.id}/${safeTitle}.md`, prd.content)
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="prd-export-${new Date().toISOString().split('T')[0]}.zip"`)
  setHeader(event, 'Content-Length', zipBuffer.length)

  return zipBuffer
})
