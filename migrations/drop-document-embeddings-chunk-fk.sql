-- 移除 document_embeddings.chunk_id 的外键约束
-- 原约束只允许引用 document_chunks(id)，无法兼容 prd_chunks(id)
-- PRD 向量化功能需要将 prd_chunks.id 存入 document_embeddings.chunk_id
-- 改为无约束 UUID，逻辑上同时支持 document_chunks 和 prd_chunks 两种来源
ALTER TABLE document_embeddings DROP CONSTRAINT IF EXISTS document_embeddings_chunk_id_fkey;
