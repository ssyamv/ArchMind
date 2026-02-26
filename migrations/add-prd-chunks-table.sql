-- PRD 知识库分块表
-- 用于将 PRD 内容切分后存储，支持 PRD 级别的 RAG 检索
CREATE TABLE IF NOT EXISTS prd_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prd_id UUID NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：按 prd_id 查询（最常用）
CREATE INDEX IF NOT EXISTS idx_prd_chunks_prd_id ON prd_chunks(prd_id);

-- 索引：按 prd_id + chunk_index 排序（有序读取分块）
CREATE INDEX IF NOT EXISTS idx_prd_chunks_prd_id_chunk_index ON prd_chunks(prd_id, chunk_index);
