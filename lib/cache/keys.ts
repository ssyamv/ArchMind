/**
 * 缓存键构建工具
 *
 * 统一管理缓存键命名规范：
 * - 格式：archmind:<domain>:<...parts>
 * - 使用冒号分隔层级，方便 Redis 管理和按模式删除
 *
 * TTL 常量（秒）：
 * - RAG_SEARCH: 10 分钟（同一查询 + workspaceId 缓存检索结果）
 * - AI_MODELS: 1 小时（模型列表变化不频繁）
 * - USER_SESSION: 24 小时（用户会话信息）
 */

const PREFIX = 'archmind'

export const CacheKeys = {
  // ─── RAG 检索结果 ───────────────────────────────
  /**
   * @param workspaceId - 工作区 ID
   * @param query - 查询文本（将被 hash 化）
   * @param topK - 返回数量
   */
  ragSearch: (workspaceId: string, query: string, topK: number) =>
    `${PREFIX}:rag:search:${workspaceId}:${hashString(query)}:${topK}`,

  /** 删除某工作区的所有检索缓存 */
  ragSearchPattern: (workspaceId: string) =>
    `${PREFIX}:rag:search:${workspaceId}:*`,

  // ─── AI 模型列表 ────────────────────────────────
  /**
   * @param provider - AI 提供商（openai / anthropic 等）
   * @param userId - 用户 ID（用户可能有不同的 API Key）
   */
  aiModels: (provider: string, userId: string) =>
    `${PREFIX}:ai:models:${provider}:${userId}`,

  /** 删除某用户的所有模型列表缓存 */
  aiModelsPattern: (userId: string) =>
    `${PREFIX}:ai:models:*:${userId}`,

  // ─── 用户会话 ────────────────────────────────────
  /**
   * @param userId - 用户 ID
   */
  userSession: (userId: string) =>
    `${PREFIX}:session:${userId}`,

  // ─── 文档元数据 ──────────────────────────────────
  /**
   * @param documentId - 文档 ID
   */
  documentMeta: (documentId: string) =>
    `${PREFIX}:doc:meta:${documentId}`
} as const

// ─── TTL 常量（秒） ───────────────────────────────────────────────────────────

export const CacheTTL = {
  /** RAG 检索结果：10 分钟 */
  RAG_SEARCH: 10 * 60,
  /** AI 模型列表：1 小时 */
  AI_MODELS: 60 * 60,
  /** 用户会话：24 小时 */
  USER_SESSION: 24 * 60 * 60,
  /** 文档元数据：30 分钟 */
  DOCUMENT_META: 30 * 60
} as const

// ─── 内部工具 ─────────────────────────────────────────────────────────────────

/**
 * 简单的字符串哈希（djb2），用于将查询文本转换为短键
 * 无需加密安全性，只需快速且碰撞率低
 */
function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0  // 转换为无符号 32 位整数
  }
  return hash.toString(36)
}
