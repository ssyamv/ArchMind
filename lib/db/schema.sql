-- 文档表
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  content TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文档块表（用于向量检索）
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 向量索引表（sqlite-vss）
CREATE VIRTUAL TABLE IF NOT EXISTS vector_index USING vss0(
  embedding(1536)
);

-- 向量映射表
CREATE TABLE IF NOT EXISTS vector_mappings (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL,
  vector_id INTEGER NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE
);

-- PRD 文档表
CREATE TABLE IF NOT EXISTS prd_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_input TEXT NOT NULL,
  model_used TEXT NOT NULL,
  generation_time INTEGER,
  token_count INTEGER,
  cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PRD 文档引用表
CREATE TABLE IF NOT EXISTS prd_document_references (
  id TEXT PRIMARY KEY,
  prd_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  relevance_score REAL,
  FOREIGN KEY (prd_id) REFERENCES prd_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 生成历史表
CREATE TABLE IF NOT EXISTS generation_history (
  id TEXT PRIMARY KEY,
  prd_id TEXT NOT NULL,
  user_input TEXT NOT NULL,
  model_used TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prd_id) REFERENCES prd_documents(id) ON DELETE CASCADE
);

-- 多模型向量表（支持任意维度，每个 chunk 可存储多个模型的向量）
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  model_name VARCHAR(100) NOT NULL,
  model_provider VARCHAR(50) NOT NULL,
  model_dimensions INTEGER NOT NULL,
  embedding vector,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chunk_id, model_name)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_vector_mappings_chunk_id ON vector_mappings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_prd_created_at ON prd_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_prd_model_used ON prd_documents(model_used);
CREATE INDEX IF NOT EXISTS idx_prd_refs_prd_id ON prd_document_references(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_refs_document_id ON prd_document_references(document_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON generation_history(created_at);
