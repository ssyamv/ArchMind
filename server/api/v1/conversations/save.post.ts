import { dbClient } from '~/lib/db/client'
import { prdDocuments, generationHistory, conversations, conversationMessages } from '~/lib/db/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { ConversationSaveRequest } from '~/types/conversation'
import { PRDSnapshotDAO } from '~/lib/db/dao/prd-snapshot-dao'
import { WorkspaceMemberDAO } from '~/lib/db/dao/workspace-member-dao'

export default defineEventHandler(async (event) => {
  const t = useServerT(event)

  try {
    const userId = requireAuth(event)
    const body = await readBody<ConversationSaveRequest>(event)

    // 验证必需字段 (title 和 finalPrdContent 均允许为空字符串)
    if (!body.conversationId || body.title === undefined || body.finalPrdContent === undefined) {
      setResponseStatus(event, 400)
      return {
        success: false,
        message: t('errors.conversationMissingFields')
      }
    }

    const pool = dbClient.getPool()
    const db = drizzle(pool)

    const prdId = crypto.randomUUID()
    const conversationDbId = crypto.randomUUID()
    const now = new Date()

    // 获取工作区 ID：优先使用传入的，否则使用用户的 owner 工作区
    let workspaceId = body.workspaceId
    if (!workspaceId) {
      const ownerWorkspace = await WorkspaceMemberDAO.getOwnerWorkspace(userId)
      workspaceId = ownerWorkspace?.id
    }

    // 提取用户输入消息
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

    // 提取对话摘要 (使用第一条用户消息的前100个字符)
    const summary = body.messages.find(m => m.role === 'user')?.content.substring(0, 100) || ''

    // 保存为 PRD 文档 (即使内容为空也保存对话记录)
    await db.insert(prdDocuments).values({
      id: prdId,
      userId,
      workspaceId: workspaceId || null, // 设置工作区 ID
      title: body.title,
      content: body.finalPrdContent || '', // 空内容时使用空字符串
      userInput: userInputs,
      modelUsed: modelsUsed || 'unknown',
      status: body.finalPrdContent ? 'published' : 'draft', // 无 PRD 内容时标记为草稿
      parentId: body.parentId || null,
      metadata: {
        conversationId: body.conversationId,
        conversationDbId, // 新增:数据库中的对话ID
        messageCount: body.messages.length,
        usedRAG: body.messages.some(m => m.useRAG),
        assistantMessages: body.messages.filter(m => m.role === 'assistant').length,
        hasPrdContent: !!body.finalPrdContent
      },
      createdAt: now,
      updatedAt: now
    })

    // 保存对话记录到 conversations 表
    await db.insert(conversations).values({
      id: conversationDbId,
      userId,
      title: body.title,
      summary,
      messageCount: body.messages.length,
      prdId,
      metadata: {
        originalConversationId: body.conversationId,
        usedRAG: body.messages.some(m => m.useRAG),
        modelsUsed: modelsUsed.split(', ')
      },
      createdAt: now,
      updatedAt: now
    })

    // 保存所有对话消息到 conversation_messages 表
    for (const message of body.messages) {
      await db.insert(conversationMessages).values({
        id: crypto.randomUUID(),
        conversationId: conversationDbId,
        role: message.role,
        content: message.content,
        modelUsed: message.modelUsed,
        useRAG: message.useRAG,
        documentIds: message.documentIds?.join(','), // 转换为逗号分隔的字符串
        prdContent: message.prdContent,
        metadata: {
          originalMessageId: message.id,
          timestamp: message.timestamp
        },
        createdAt: new Date(message.timestamp)
      })
    }

    // Log generation history for each AI message
    for (const message of body.messages.filter(m => m.role === 'assistant')) {
      await db.insert(generationHistory).values({
        id: crypto.randomUUID(),
        modelUsed: message.modelUsed || 'unknown',
        userInput: '', // Would be associated with previous user message
        status: 'completed',
        createdAt: now
      })
    }

    // 首次创建 PRD 后，异步创建自动快照（fire-and-forget）
    if (body.finalPrdContent) {
      setImmediate(async () => {
        try {
          await PRDSnapshotDAO.create({
            prdId,
            createdBy: userId,
            snapshotType: 'auto',
            content: body.finalPrdContent
          })
          await PRDSnapshotDAO.pruneAutoSnapshots(prdId)
        } catch (e) {
          console.warn('[PRDSnapshot] auto snapshot failed on create:', e)
        }
      })
    }

    return {
      success: true,
      id: prdId,
      message: t('errors.conversationSavedSuccess')
    }
  } catch (error) {
    console.error('Save conversation error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      message: error instanceof Error ? error.message : t(ErrorKeys.UNKNOWN_ERROR)
    }
  }
})
