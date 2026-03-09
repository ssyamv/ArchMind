-- 回滚：移除 RAG 检索日志表
DROP INDEX IF EXISTS idx_rag_logs_document_ids;
DROP INDEX IF EXISTS idx_rag_logs_workspace_created;
DROP TABLE IF EXISTS rag_retrieval_logs;
