-- 生产数据库综合修复脚本
-- 执行时间：2026-03-02
-- 修复内容：添加缺失的列并回填数据

\echo '=== 开始生产数据库修复 ==='
\echo ''

-- ============================================
-- 1. 修复 documents.search_vector 列
-- ============================================
\echo '1️⃣ 添加 documents.search_vector 列...'

-- 1.1 添加列
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 1.2 创建 GIN 索引
CREATE INDEX IF NOT EXISTS idx_documents_search_vector
  ON documents USING GIN(search_vector);

-- 1.3 回填现有数据（中文使用 simple 配置）
UPDATE documents
SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(content, '')), 'B')
WHERE search_vector IS NULL;

\echo '✅ documents.search_vector 修复完成'
\echo ''

-- ============================================
-- 2. 修复 prd_documents.parent_id 列
-- ============================================
\echo '2️⃣ 添加 prd_documents.parent_id 列...'

-- 2.1 添加列（自引用外键）
ALTER TABLE prd_documents
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES prd_documents(id) ON DELETE SET NULL;

-- 2.2 创建索引
CREATE INDEX IF NOT EXISTS idx_prd_parent_id ON prd_documents(parent_id);

\echo '✅ prd_documents.parent_id 修复完成'
\echo ''

-- ============================================
-- 3. 验证修复结果
-- ============================================
\echo '3️⃣ 验证修复结果...'
\echo ''

\echo '📊 documents.search_vector 统计：'
SELECT
  COUNT(*) as total_documents,
  COUNT(search_vector) as with_search_vector,
  COUNT(*) - COUNT(search_vector) as missing_search_vector
FROM documents;

\echo ''
\echo '📊 prd_documents.parent_id 统计：'
SELECT
  COUNT(*) as total_prds,
  COUNT(parent_id) as with_parent_id,
  COUNT(*) - COUNT(parent_id) as without_parent_id
FROM prd_documents;

\echo ''
\echo '✅ 所有修复完成！'
