import { dbClient } from '~/lib/db/client'
import { prdDocuments, conversations, conversationMessages } from '~/lib/db/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import type { ConversationMessage } from '~/types/conversation'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'prdId')
    if (!prdId) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.conversationPrdIdMissing') }
    }

    const body = await readBody<{
      messages: ConversationMessage[]
      finalPrdContent: string
      title?: string
    }>(event)

    if (!body.messages || body.finalPrdContent === undefined) {
      setResponseStatus(event, 400)
      return { success: false, message: t('errors.conversationMissingFields') }
    }

    const pool = dbClient.getPool()
    const db = drizzle(pool)
    const now = new Date()

    // 查找现有 PRD 文档以获取关联的 conversationDbId
    const existingPrd = await db.select()
      .from(prdDocuments)
      .where(eq(prdDocuments.id, prdId))
      .limit(1)

    if (existingPrd.length === 0) {
      setResponseStatus(event, 404)
      return { success: false, message: t('errors.conversationNotFound') }
    }

    const prd = existingPrd[0]

    // PRD 归属校验
    requireResourceOwner({ userId: prd.userId }, userId)

    const conversationDbId = (prd.metadata as any)?.conversationDbId

    // 提取用户输入
    const userInputs = body.messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n---\n')

    // 提取使用的模型列表
    const modelsUsed = [...new Set(
      body.messages
        .filter(m => m.modelUsed)
        .map(m => m.modelUsed)
    )].join(', ')

    // 更新 PRD 文档
    await db.update(prdDocuments)
      .set({
        content: body.finalPrdContent || '',
        title: body.title || prd.title,
        userInput: userInputs,
        modelUsed: modelsUsed || 'unknown',
        status: body.finalPrdContent ? 'published' : 'draft',
        metadata: {
          ...(prd.metadata as object || {}),
          messageCount: body.messages.length,
          usedRAG: body.messages.some(m => m.useRAG),
          assistantMessages: body.messages.filter(m => m.role === 'assistant').length,
          hasPrdContent: !!body.finalPrdContent
        },
        updatedAt: now
      })
      .where(eq(prdDocuments.id, prdId))

    // 更新 conversations 表
    if (conversationDbId) {
      const summary = body.messages.find(m => m.role === 'user')?.content.substring(0, 100) || ''

      await db.update(conversations)
        .set({
          title: body.title || prd.title,
          summary,
          messageCount: body.messages.length,
          metadata: {
            usedRAG: body.messages.some(m => m.useRAG),
            modelsUsed: modelsUsed.split(', ')
          },
          updatedAt: now
        })
        .where(eq(conversations.id, conversationDbId))

      // 删除旧消息并重新插入所有消息（简单可靠）
      await db.delete(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversationDbId))

      for (const message of body.messages) {
        await db.insert(conversationMessages).values({
          id: crypto.randomUUID(),
          conversationId: conversationDbId,
          role: message.role,
          content: message.content,
          modelUsed: message.modelUsed,
          useRAG: message.useRAG,
          documentIds: message.documentIds?.join(','),
          prdContent: message.prdContent,
          metadata: {
            originalMessageId: message.id,
            timestamp: message.timestamp
          },
          createdAt: new Date(message.timestamp)
        })
      }
    }

    return {
      success: true,
      id: prdId,
      message: t('errors.conversationUpdatedSuccess')
    }
  } catch (error) {
    console.error('Update conversation error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
