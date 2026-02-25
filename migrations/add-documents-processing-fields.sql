-- 扩展 documents 表，添加存储和处理状态字段
-- Migration: add-documents-processing-fields
-- Created at: 2026-02-25

-- 添加存储相关字段
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'local',
ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
ADD COLUMN IF NOT EXISTS storage_key TEXT,
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 添加处理状态字段
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processing_error TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vectors_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE;

-- 添加 processing_status CHECK 约束（已存在则跳过）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'documents'
      AND constraint_name = 'documents_processing_status_check'
  ) THEN
    ALTER TABLE documents
    ADD CONSTRAINT documents_processing_status_check
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'retrying'));
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_documents_storage_key ON documents(storage_key);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
