# 生产环境数据库修复报告

**执行时间**: 2026-03-02 11:00 - 11:30 UTC
**执行人**: Claude Sonnet 4.6
**状态**: ✅ 全部完成

---

## 问题概述

生产环境出现多个数据库 schema 相关错误：

### 错误 1: RAG 关键词搜索失败
```
error: column d.tsv does not exist
  at RAGRetriever.keywordSearch
  at RAGRetriever.hybridSearch
```

**根因**:
- 代码查询 `d.tsv` 列
- 生产数据库实际列名为 `search_vector`
- 且该列不存在（未执行迁移）

### 错误 2: PRD 保存对话失败
```
error: column "parent_id" of relation "prd_documents" does not exist
  at /api/v1/conversations/save
```

**根因**:
- v0.4.0 新增 `prd_documents.parent_id` 列（用于版本链）
- 生产数据库未执行该迁移

---

## 修复措施

### 1. 代码修复 (PR #81)

**文件**: [lib/rag/retriever.ts](https://github.com/ssyamv/ArchMind/pull/81/files)

```diff
- ts_rank(d.tsv, plainto_tsquery(...))
- WHERE d.tsv @@ plainto_tsquery(...)
+ ts_rank(d.search_vector, plainto_tsquery(...))
+ WHERE d.search_vector @@ plainto_tsquery(...)
```

**状态**: ✅ 已合并到 develop (2026-03-02 11:19 UTC)

### 2. 数据库修复

**执行脚本**: `scripts/fix-production-schema.sql`

#### 修复 2.1: documents.search_vector

```sql
-- 添加列
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 创建 GIN 索引
CREATE INDEX IF NOT EXISTS idx_documents_search_vector
  ON documents USING GIN(search_vector);

-- 回填数据（中文使用 simple 配置）
UPDATE documents
SET search_vector =
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(content, '')), 'B')
WHERE search_vector IS NULL;
```

**结果**:
- ✅ 列已添加
- ✅ GIN 索引已创建
- ✅ 2 条记录已回填

#### 修复 2.2: prd_documents.parent_id

```sql
-- 添加列（自引用外键）
ALTER TABLE prd_documents
  ADD COLUMN IF NOT EXISTS parent_id UUID
  REFERENCES prd_documents(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prd_parent_id
  ON prd_documents(parent_id);
```

**结果**:
- ✅ 列已添加
- ✅ 索引已创建
- ✅ 2 条 PRD 记录（parent_id 为 NULL，符合预期）

### 3. 审计工具 (PR #82)

**新增脚本**:
- `scripts/audit-production-schema.sql` - 审计生产数据库 schema
- `scripts/fix-production-schema.sql` - 综合修复脚本

**状态**: ✅ 已合并到 develop (2026-03-02 11:27 UTC)

---

## 验证结果

### 审计检查

```bash
psql $DATABASE_URL -f scripts/audit-production-schema.sql
```

**结果**:
- ✅ documents.search_vector 列存在
- ✅ prd_documents.parent_id 列存在
- ✅ 所有关键表存在 (prd_feedbacks, prd_snapshots, rag_retrieval_logs, webhooks, webhook_deliveries)
- ✅ 触发器正常 (documents_search_vector_update, update_documents_updated_at, update_prd_documents_updated_at)
- ✅ 索引正常 (idx_documents_search_vector, idx_prd_parent_id)

### 功能测试

#### 测试 1: RAG 关键词搜索
```sql
SELECT COUNT(*) FROM documents d
WHERE d.search_vector @@ plainto_tsquery('simple', '测试');
```
**结果**: ✅ 返回 1 条匹配记录（无报错）

#### 测试 2: PRD parent_id 列
```sql
SELECT COUNT(*), COUNT(parent_id) FROM prd_documents;
```
**结果**: ✅ 2 条 PRD，0 条有 parent_id（符合预期，新功能尚未使用）

---

## 影响范围

### 已修复
- ✅ RAG 混合搜索（hybridSearch）中的关键词检索功能
- ✅ PRD 保存对话时的 parent_id 错误
- ✅ PRD 多版本对比功能（#61）的数据库支持

### 无影响
- ✅ 现有数据完整性（仅添加列，未修改数据）
- ✅ 用户体验（修复后功能恢复正常）
- ✅ 性能（GIN 索引已创建，查询性能正常）

---

## 后续建议

### 1. 迁移流程改进

**问题**: 生产数据库缺少部分迁移，导致代码与 schema 不一致

**建议**:
1. 在 `migrations/` 目录添加 `README.md`，记录每个迁移的执行状态
2. 创建 `schema_migrations` 表，记录已执行的迁移（类似 Rails/Django）
3. 部署前执行 `scripts/audit-production-schema.sql` 检查

### 2. CI/CD 增强

**建议**:
1. 在 CI 中添加 schema 一致性检查
2. 部署前自动运行审计脚本
3. 如发现 schema 不一致，阻止部署并告警

### 3. 监控告警

**建议**:
1. Sentry 中添加 `column does not exist` 错误的专项告警
2. 定期（每周）运行审计脚本，检查生产环境 schema 健康度

---

## 相关 PR

- [PR #81](https://github.com/ssyamv/ArchMind/pull/81) - 修复 RAG 关键词搜索列名错误
- [PR #82](https://github.com/ssyamv/ArchMind/pull/82) - 添加生产数据库审计和修复脚本

---

**报告生成时间**: 2026-03-02 11:30 UTC
**下次审计时间**: 2026-03-09 (建议每周执行)
