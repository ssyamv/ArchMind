-- 生产数据库 Schema 审计脚本
-- 检查所有应该存在但可能缺失的列

\echo '=== 1. 检查 documents 表 ==='
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'search_vector'
  ) THEN '✅ search_vector 列存在'
  ELSE '❌ search_vector 列缺失'
  END as status;

\echo ''
\echo '=== 2. 检查 prd_documents 表 ==='
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prd_documents' AND column_name = 'parent_id'
  ) THEN '✅ parent_id 列存在'
  ELSE '❌ parent_id 列缺失'
  END as status;

\echo ''
\echo '=== 3. 检查关键表是否存在 ==='
SELECT
  table_name,
  CASE WHEN table_name IN (
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  ) THEN '✅ 存在' ELSE '❌ 缺失' END as status
FROM (VALUES
  ('prd_feedbacks'),
  ('prd_snapshots'),
  ('rag_retrieval_logs'),
  ('webhooks'),
  ('webhook_deliveries')
) AS expected(table_name);

\echo ''
\echo '=== 4. 检查触发器 ==='
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('documents', 'prd_documents')
ORDER BY event_object_table, trigger_name;

\echo ''
\echo '=== 5. 检查索引 ==='
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('documents', 'prd_documents')
  AND (indexname LIKE '%search_vector%' OR indexname LIKE '%parent_id%')
ORDER BY tablename, indexname;
