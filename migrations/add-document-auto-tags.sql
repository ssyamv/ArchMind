-- #68 文档自动标签数据库迁移

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS suggested_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS suggested_tags TEXT[],
  ADD COLUMN IF NOT EXISTS auto_summary TEXT,
  ADD COLUMN IF NOT EXISTS auto_doc_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS auto_tags_confidence DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS auto_tags_confirmed BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documents_auto_tags_confirmed
  ON documents(auto_tags_confirmed) WHERE auto_tags_confirmed = false;
