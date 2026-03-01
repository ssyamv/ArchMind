-- #59 RAG 检索质量评估面板
-- 创建 rag_retrieval_logs 表

CREATE TABLE IF NOT EXISTS rag_retrieval_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID,                            -- 可为 NULL（未指定工作区时）
  user_id           UUID,                            -- 可为 NULL（匿名检索时）
  query_hash        TEXT NOT NULL,                   -- SHA-256 of query（不存明文）
  document_ids      UUID[],                          -- 被引用的文档 ID 列表
  similarity_scores FLOAT[],                         -- 对应相似度分数
  strategy          TEXT,                            -- 'vector' | 'hybrid'
  threshold         FLOAT,                           -- 实际使用的阈值
  result_count      INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_logs_workspace_created
  ON rag_retrieval_logs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_logs_document_ids
  ON rag_retrieval_logs USING GIN(document_ids);
