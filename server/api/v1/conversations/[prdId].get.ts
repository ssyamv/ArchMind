import { dbClient } from '~/lib/db/client'
import { conversations, conversationMessages, prdDocuments } from '~/lib/db/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'

interface PRDMetadata {
  conversationId?: string
  conversationDbId?: string
  [key: string]: unknown
}

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const prdId = getRouterParam(event, 'prdId')

    if (!prdId) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t('errors.prdIdMissing')
      }
    }

    const pool = dbClient.getPool()
    const db = drizzle(pool)

    // 先获取 PRD 文档,从中获取 conversationDbId
    const [prd] = await db
      .select()
      .from(prdDocuments)
      .where(eq(prdDocuments.id, prdId))
      .limit(1)

    if (!prd) {
      setResponseStatus(event, 404)
      return {
        success: false,
        message: t('errors.prdDoesNotExist')
      }
    }

    // PRD 归属校验
    requireResourceOwner({ userId: prd.userId }, userId)

    // 从 metadata 中获取 conversationDbId
    const conversationDbId = (prd.metadata as PRDMetadata)?.conversationDbId

    if (!conversationDbId) {
      // 如果没有对话历史,返回空数组
      return {
        success: true,
        data: {
          conversation: null,
          messages: [],
          prdContent: prd.content
        }
      }
    }

    // 获取对话记录
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationDbId))
      .limit(1)

    // 获取所有对话消息,按时间排序
    const messages = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationDbId))
      .orderBy(conversationMessages.createdAt)

    // 转换消息格式
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      modelUsed: msg.modelUsed,
      useRAG: msg.useRAG,
      documentIds: msg.documentIds ? msg.documentIds.split(',') : [],
      prdContent: msg.prdContent,
      timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
      isStreaming: false
    }))

    return {
      success: true,
      data: {
        conversation,
        messages: formattedMessages,
        prdContent: prd.content
      }
    }
  } catch (error) {
    console.error('Load conversation error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
