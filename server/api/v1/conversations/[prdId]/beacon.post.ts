import { dbClient } from '~/lib/db/client'
import { prdDocuments } from '~/lib/db/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import type { ConversationMessage } from '~/types/conversation'

// 供 navigator.sendBeacon 使用的端点（浏览器关闭时调用）
// 只更新 PRD 内容，不重建 conversation_messages
export default defineEventHandler(async (event) => {
  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'prdId')
    if (!prdId) {
      setResponseStatus(event, 400)
      return { success: false }
    }

    const body = await readBody<{
      messages: ConversationMessage[]
      finalPrdContent: string
      title?: string
    }>(event)

    if (!body || body.finalPrdContent === undefined) {
      setResponseStatus(event, 400)
      return { success: false }
    }

    const pool = dbClient.getPool()
    const db = drizzle(pool)

    const existingPrd = await db.select()
      .from(prdDocuments)
      .where(eq(prdDocuments.id, prdId))
      .limit(1)

    if (existingPrd.length === 0) {
      setResponseStatus(event, 404)
      return { success: false }
    }

    const prd = existingPrd[0]

    // PRD 归属校验
    requireResourceOwner({ userId: prd.userId }, userId)

    const modelsUsed = [...new Set(
      (body.messages || [])
        .filter(m => m.modelUsed)
        .map(m => m.modelUsed)
    )].join(', ')

    await db.update(prdDocuments)
      .set({
        content: body.finalPrdContent || '',
        title: body.title || prd.title,
        modelUsed: modelsUsed || prd.modelUsed,
        status: body.finalPrdContent ? 'published' : 'draft',
        metadata: {
          ...(prd.metadata as object || {}),
          hasPrdContent: !!body.finalPrdContent
        },
        updatedAt: new Date()
      })
      .where(eq(prdDocuments.id, prdId))

    return { success: true }
  } catch (error) {
    console.error('Beacon save error:', error)
    setResponseStatus(event, 500)
    return { success: false }
  }
})
