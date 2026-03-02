import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { Conversation, ConversationMessage, ConversationTargetType, ConversationTargetContext, ImageAttachment } from '~/types/conversation'
import { useWorkspace } from '~/composables/useWorkspace'

const STORAGE_KEY = 'conversation:active'

export function useConversation () {
  const { currentWorkspaceId } = useWorkspace()

  const conversation = ref<Conversation>({
    id: nanoid(),
    messages: [],
    currentPrdContent: '',
    target: 'prd',
    createdAt: Date.now(),
    updatedAt: Date.now()
  })

  const messages = computed(() => conversation.value.messages)
  const currentPrdContent = computed(() => conversation.value.currentPrdContent)
  const currentTarget = computed(() => conversation.value.target)
  const targetContext = computed(() => conversation.value.targetContext)

  // Load from localStorage
  function loadFromStorage () {
    if (!process.client) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      conversation.value = parsed
    } catch (e) {
      console.warn('Corrupted conversation localStorage data, clearing:', e)
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // Load from database (for continuing saved conversations)
  async function loadFromDatabase (prdId: string) {
    try {
      const response = await $fetch<{ success: boolean; data: any }>(`/api/v1/conversations/${prdId}`)
      if (response.success && response.data.messages) {
        conversation.value = {
          id: nanoid(),
          title: response.data.conversation?.title,
          messages: response.data.messages,
          currentPrdContent: response.data.prdContent || '',
          target: 'prd',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          savedToDb: true,
          dbId: prdId,
          lastSavedMessageCount: response.data.messages.length
        }
        saveToStorage()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to load conversation from database:', error)
      return false
    }
  }

  // Save to localStorage
  function saveToStorage () {
    if (!process.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation.value))
    } catch (e) {
      console.warn('Failed to save conversation to localStorage (quota exceeded?):', e)
    }
  }

  // Add user message
  function addUserMessage (content: string, options?: { modelUsed?: string; useRAG?: boolean; documentIds?: string[]; documentTitles?: string[]; images?: ImageAttachment[] }) {
    const message: ConversationMessage = {
      id: nanoid(),
      role: 'user',
      content,
      modelUsed: options?.modelUsed,
      useRAG: options?.useRAG,
      documentIds: options?.documentIds,
      documentTitles: options?.documentTitles,
      images: options?.images,
      timestamp: Date.now()
    }
    conversation.value.messages.push(message)
    conversation.value.updatedAt = Date.now()
    saveToStorage()
    return message
  }

  // Add AI message (streaming placeholder)
  function addAIMessage (options?: { modelUsed?: string; useRAG?: boolean }) {
    const targetContentType = getTargetContentType(conversation.value.target)
    const message: ConversationMessage = {
      id: nanoid(),
      role: 'assistant',
      content: '',
      modelUsed: options?.modelUsed,
      useRAG: options?.useRAG,
      timestamp: Date.now(),
      isStreaming: true,
      prdContent: '',
      targetContentType
    }
    conversation.value.messages.push(message)
    return message
  }

  // Update AI message with streamed content
  function updateAIMessage (messageId: string, chunk: string) {
    const message = conversation.value.messages.find(m => m.id === messageId)
    if (message) {
      message.content += chunk
      conversation.value.updatedAt = Date.now()
      saveToStorage()
    }
  }

  // Update AI message thinking content (reasoning models like GLM-4.7)
  function updateAIThinkingMessage (messageId: string, chunk: string) {
    const message = conversation.value.messages.find(m => m.id === messageId)
    if (message) {
      message.thinkingContent = (message.thinkingContent ?? '') + chunk
      conversation.value.updatedAt = Date.now()
      saveToStorage()
    }
  }

  // Mark AI message as complete
  function completeAIMessage (messageId: string) {
    const message = conversation.value.messages.find(m => m.id === messageId)
    if (message) {
      message.isStreaming = false
      conversation.value.updatedAt = Date.now()
      saveToStorage()
    }
  }

  // Save conversation to database (first time)
  async function saveConversation (title: string, parentId?: string) {
    try {
      const response = await $fetch<{ success: boolean; id: string }>('/api/v1/conversations/save', {
        method: 'POST',
        body: {
          conversationId: conversation.value.id,
          title,
          messages: conversation.value.messages,
          finalPrdContent: conversation.value.currentPrdContent,
          parentId: parentId || undefined,
          workspaceId: currentWorkspaceId.value || undefined // 传递当前工作区 ID
        }
      })
      conversation.value.savedToDb = true
      conversation.value.dbId = response.id
      conversation.value.title = title
      conversation.value.lastSavedMessageCount = conversation.value.messages.length
      saveToStorage()
      return response
    } catch (error) {
      console.error('Failed to save conversation:', error)
      throw error
    }
  }

  // Update existing conversation in database
  async function updateConversation () {
    if (!conversation.value.dbId) return
    try {
      const conv = conversation.value
      // 使用当前已保存的标题（不从 PRD 内容覆盖用户手动设置的标题）
      const title = conv.title
      await $fetch(`/api/v1/conversations/${conversation.value.dbId}`, {
        method: 'PUT',
        body: {
          messages: conversation.value.messages,
          finalPrdContent: conversation.value.currentPrdContent,
          title
        }
      })
      conversation.value.lastSavedMessageCount = conversation.value.messages.length
      saveToStorage()
    } catch (error) {
      console.error('Failed to update conversation:', error)
      throw error
    }
  }

  // Mark PRD content as dirty (manually edited), forces next save to proceed
  function markPrdContentDirty () {
    conversation.value.lastSavedMessageCount = -1
    saveToStorage()
  }

  // Auto-save to database (create or update)
  async function autoSaveToDatabase (parentId?: string) {
    const conv = conversation.value
    // 没有消息时不保存
    if (conv.messages.length === 0) return

    // 消息数量没有变化且内容未被手动编辑时不保存
    if (conv.lastSavedMessageCount === conv.messages.length) return

    // 原型目标不自动保存到 PRD 数据库
    if (conv.target === 'prototype') return

    if (conv.savedToDb && conv.dbId) {
      // 已有数据库记录，更新
      await updateConversation()
    } else {
      // 首次保存，标题留空（前端显示"未命名项目"作为占位）
      await saveConversation('', parentId)
    }
  }

  // Switch conversation target
  function switchTarget (newTarget: ConversationTargetType) {
    conversation.value.target = newTarget
    conversation.value.targetContext = undefined
    conversation.value.updatedAt = Date.now()
    saveToStorage()
  }

  // Update target context
  function updateTargetContext (context: Partial<ConversationTargetContext>) {
    conversation.value.targetContext = {
      ...conversation.value.targetContext,
      ...context
    }
    saveToStorage()
  }

  // Get content type based on target
  function getTargetContentType (target: ConversationTargetType): 'markdown' | 'html' | 'json' {
    switch (target) {
      case 'prototype':
        return 'html'
      default:
        return 'markdown'
    }
  }

  // Delete messages from a specific message onwards (back functionality)
  function deleteMessagesFrom (messageId: string) {
    const messageIndex = conversation.value.messages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      conversation.value.messages = conversation.value.messages.slice(0, messageIndex)
      conversation.value.updatedAt = Date.now()
      saveToStorage()
    }
  }

  // Get message by ID
  function getMessage (messageId: string): ConversationMessage | undefined {
    return conversation.value.messages.find(m => m.id === messageId)
  }

  // Reset conversation
  function reset () {
    if (process.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
    conversation.value = {
      id: nanoid(),
      messages: [],
      currentPrdContent: '',
      target: 'prd',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    saveToStorage()
  }

  return {
    conversation,
    messages,
    currentPrdContent,
    currentTarget,
    targetContext,
    loadFromStorage,
    loadFromDatabase,
    saveToStorage,
    addUserMessage,
    addAIMessage,
    updateAIMessage,
    updateAIThinkingMessage,
    completeAIMessage,
    saveConversation,
    autoSaveToDatabase,
    markPrdContentDirty,
    switchTarget,
    updateTargetContext,
    deleteMessagesFrom,
    getMessage,
    reset
  }
}
