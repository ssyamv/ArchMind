/**
 * Embedding 服务统一初始化工具
 *
 * Embedding 服务与对话模型无关，只使用 GLM Embedding。
 *
 * 所有需要 Embedding 的服务端模块统一从这里获取适配器，
 * 确保写入（文档上传/向量化）和读取（对话检索）使用相同的模型，
 * 避免向量维度不匹配导致语义检索失效。
 */

import type { IEmbeddingAdapter } from '~/lib/rag/embedding-adapter'

export async function createEmbeddingAdapter (apiKeys: {
  glmApiKey?: string
}): Promise<IEmbeddingAdapter | null> {
  const { glmApiKey } = apiKeys

  if (glmApiKey) {
    const { GLMEmbeddingAdapter } = await import('~/lib/rag/adapters/glm-embedding')
    return new GLMEmbeddingAdapter(glmApiKey)
  }

  return null
}
