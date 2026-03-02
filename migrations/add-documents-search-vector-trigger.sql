-- 为 documents.search_vector 添加自动更新触发器
-- 背景：init-db.sql 中已建 search_vector tsvector 列，但未创建触发器，
--       导致列始终为 NULL，关键词搜索（keywordSearch）无法命中任何文档。
-- 执行时机：v0.4.0 生产环境迁移时执行

-- 1. 创建触发器函数
--    中文内容使用 simple 配置（逐字索引），同时包含标题（权重 A）和内容（权重 B）
CREATE OR REPLACE FUNCTION documents_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 2. 绑定触发器（INSERT 或 title/content 更新时自动触发）
DROP TRIGGER IF EXISTS documents_search_vector_update ON documents;
CREATE TRIGGER documents_search_vector_update
  BEFORE INSERT OR UPDATE OF title, content
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION documents_search_vector_trigger();

-- 3. 回填现有数据（search_vector 为 NULL 的记录）
UPDATE documents
SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(content, '')), 'B')
WHERE search_vector IS NULL;

-- 4. 验证（执行后应看到 idx_documents_search 索引正常）
-- SELECT COUNT(*) FROM documents WHERE search_vector IS NOT NULL;
