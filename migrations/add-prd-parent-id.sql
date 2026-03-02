-- #61 PRD 多版本对比：添加 parent_id 字段建立版本链
ALTER TABLE prd_documents
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES prd_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prd_parent_id ON prd_documents(parent_id);
