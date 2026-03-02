# v0.4.0 生产环境迁移检查清单

> **执行时间**: 合并 PR #80 到 main 并部署到 Vercel 后
> **预计耗时**: 30-45 分钟
> **风险等级**: 中等（涉及数据库结构变更和数据清理）

---

## 📋 迁移前准备

### 1. 备份数据库

```bash
# 1.1 连接到生产数据库
export DATABASE_URL="<Vercel 生产数据库 URL>"

# 1.2 创建完整备份
pg_dump $DATABASE_URL > backup_v0.4.0_$(date +%Y%m%d_%H%M%S).sql

# 1.3 验证备份文件
ls -lh backup_v0.4.0_*.sql
```

### 2. 检查当前数据库状态

```bash
# 2.1 检查现有表
psql $DATABASE_URL -c "\dt"

# 2.2 检查是否存在待迁移的表（应该不存在）
psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prd_feedbacks');"
psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prd_snapshots');"
psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rag_retrieval_logs');"
```

---

## 🗄️ 数据库迁移

### 步骤 1: 添加 PRD 反馈表

```bash
# 执行迁移
psql $DATABASE_URL -f migrations/add-prd-feedbacks.sql

# 验证表创建成功
psql $DATABASE_URL -c "\d prd_feedbacks"
```

**预期结果**:
```
Table "public.prd_feedbacks"
   Column    |           Type           | Nullable |
-------------+--------------------------+----------+
 id          | uuid                     | not null |
 prd_id      | uuid                     | not null |
 user_id     | uuid                     | not null |
 rating      | integer                  | not null |
 comment     | text                     |          |
 created_at  | timestamp with time zone | not null |
```

### 步骤 2: 添加 PRD 快照表

```bash
# 执行迁移
psql $DATABASE_URL -f migrations/add-prd-snapshots.sql

# 验证表创建成功
psql $DATABASE_URL -c "\d prd_snapshots"
```

**预期结果**:
```
Table "public.prd_snapshots"
     Column      |           Type           | Nullable |
-----------------+--------------------------+----------+
 id              | uuid                     | not null |
 prd_id          | uuid                     | not null |
 version_number  | integer                  | not null |
 title           | text                     | not null |
 content         | text                     | not null |
 snapshot_type   | text                     | not null |
 description     | text                     |          |
 created_by      | uuid                     | not null |
 created_at      | timestamp with time zone | not null |
```

### 步骤 3: 添加 RAG 检索日志表

```bash
# 执行迁移
psql $DATABASE_URL -f migrations/add-rag-retrieval-logs.sql

# 验证表创建成功
psql $DATABASE_URL -c "\d rag_retrieval_logs"
```

**预期结果**:
```
Table "public.rag_retrieval_logs"
     Column      |           Type           | Nullable |
-----------------+--------------------------+----------+
 id              | uuid                     | not null |
 query_hash      | text                     | not null |
 strategy        | text                     | not null |
 threshold       | numeric(3,2)             |          |
 result_count    | integer                  | not null |
 duration_ms     | integer                  | not null |
 user_id         | uuid                     |          |
 workspace_id    | uuid                     |          |
 created_at      | timestamp with time zone | not null |
```

---

## 🧹 数据清理（关键！）

### 问题 1: prd_documents 跨用户脏数据

**背景**: 早期版本 `workspace_id` 使用字符串 `'default'` 而非 UUID，导致多用户 PRD 混存。

#### 1.1 排查脏数据

```sql
-- 检查是否存在 workspace_id = 'default' 的记录
SELECT
    pd.user_id,
    u.email,
    COUNT(*) as prd_count,
    STRING_AGG(pd.title, ', ') as prd_titles
FROM prd_documents pd
LEFT JOIN users u ON u.id = pd.user_id
WHERE pd.workspace_id = 'default'
GROUP BY pd.user_id, u.email
ORDER BY prd_count DESC;
```

**如果有结果，继续执行以下步骤**:

#### 1.2 查找每个用户的 owner 工作区

```sql
-- 查出每个用户自己 owner 的工作区
SELECT
    u.id as user_id,
    u.email,
    wm.workspace_id,
    w.name as workspace_name
FROM users u
JOIN workspace_members wm ON wm.user_id = u.id AND wm.role = 'owner'
JOIN workspaces w ON w.id = wm.workspace_id
ORDER BY u.email;
```

#### 1.3 迁移 PRD 到正确的工作区

```sql
-- 为每个用户执行（替换 <user_id> 和 <workspace_id>）
UPDATE prd_documents
SET workspace_id = '<用户的owner工作区UUID>'
WHERE user_id = '<用户UUID>' AND workspace_id = 'default';

-- 示例（根据实际情况替换）:
-- UPDATE prd_documents
-- SET workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- WHERE user_id = 'f1e2d3c4-b5a6-7890-cdef-123456789abc' AND workspace_id = 'default';
```

#### 1.4 验证迁移结果

```sql
-- 确认没有 'default' 工作区的 PRD
SELECT COUNT(*) FROM prd_documents WHERE workspace_id = 'default';
-- 预期结果: 0

-- 确认每个用户的 PRD 都在其 owner 工作区
SELECT
    u.email,
    w.name as workspace_name,
    COUNT(pd.id) as prd_count
FROM prd_documents pd
JOIN users u ON u.id = pd.user_id
JOIN workspaces w ON w.id = pd.workspace_id
JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = u.id
WHERE wm.role = 'owner'
GROUP BY u.email, w.name
ORDER BY u.email;
```

### 问题 2: documents 表同样问题

#### 2.1 排查脏数据

```sql
-- 检查是否存在 workspace_id = 'default' 的记录
SELECT
    d.workspace_id,
    u.email,
    COUNT(*) as doc_count,
    STRING_AGG(d.title, ', ') as doc_titles
FROM documents d
LEFT JOIN users u ON u.id = d.user_id
WHERE d.workspace_id = 'default'
GROUP BY d.workspace_id, u.email
ORDER BY doc_count DESC;
```

#### 2.2 迁移文档到正确的工作区

```sql
-- 为每个用户执行（替换 <user_id> 和 <workspace_id>）
UPDATE documents
SET workspace_id = '<用户的owner工作区UUID>'
WHERE user_id = '<用户UUID>' AND workspace_id = 'default';
```

#### 2.3 验证迁移结果

```sql
-- 确认没有 'default' 工作区的文档
SELECT COUNT(*) FROM documents WHERE workspace_id = 'default';
-- 预期结果: 0
```

---

## 🔍 Redis 缓存清理

### 清理旧版本缓存

```bash
# 如果配置了 REDIS_URL
redis-cli -u $REDIS_URL

# 在 Redis CLI 中执行
KEYS *rag:*
KEYS *ai:models:*

# 清理所有 RAG 相关缓存（因为阈值策略已变更）
SCAN 0 MATCH rag:* COUNT 100
# 对每个 key 执行 DEL

# 或者直接清空所有缓存（如果 Redis 仅用于 ArchMind）
FLUSHDB
```

---

## ✅ 功能验证

### 1. PRD 反馈功能

```bash
# 1.1 创建测试反馈
curl -X POST https://your-domain.vercel.app/api/v1/prd/<prd_id>/feedback \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=<your_token>" \
  -d '{"rating": 5, "comment": "测试反馈"}'

# 1.2 查询 PRD 详情（应包含平均评分）
curl https://your-domain.vercel.app/api/v1/prd/<prd_id> \
  -H "Cookie: auth_token=<your_token>"
```

### 2. PRD 版本快照

```bash
# 2.1 创建快照
curl -X POST https://your-domain.vercel.app/api/v1/prd/<prd_id>/snapshots \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=<your_token>" \
  -d '{"description": "测试快照"}'

# 2.2 查询快照列表
curl https://your-domain.vercel.app/api/v1/prd/<prd_id>/snapshots \
  -H "Cookie: auth_token=<your_token>"
```

### 3. RAG 检索质量面板

```bash
# 访问工作区设置页面
open https://your-domain.vercel.app/workspace/<workspace_id>/settings

# 切换到 "RAG 质量" Tab，确认数据正常显示
```

### 4. Webhook 管理界面

```bash
# 访问工作区设置页面
open https://your-domain.vercel.app/workspace/<workspace_id>/settings

# 切换到 "Webhooks" Tab，测试创建/编辑/删除
```

### 5. 原型主题定制

```bash
# 生成新原型时，确认主题选择器正常显示
# 切换主题后，确认原型预览正确应用主题
```

---

## 📊 监控指标

### 1. 数据库性能

```sql
-- 检查新表的索引
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('prd_feedbacks', 'prd_snapshots', 'rag_retrieval_logs')
ORDER BY tablename, indexname;

-- 检查表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('prd_feedbacks', 'prd_snapshots', 'rag_retrieval_logs')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 2. Sentry 错误监控

```bash
# 访问 Sentry Dashboard
open https://sentry.io/organizations/<your-org>/issues/

# 检查是否有新的错误报告
# 重点关注：
# - /api/v1/prd/:id/feedback
# - /api/v1/prd/:id/snapshots
# - /api/v1/rag/quality
# - /api/v1/webhooks/*
```

### 3. Vercel 部署日志

```bash
# 查看最近的部署日志
vercel logs --follow

# 检查是否有数据库连接错误或迁移相关错误
```

---

## 🚨 回滚计划

如果迁移出现严重问题，执行以下回滚步骤：

### 1. 回滚代码

```bash
# 在 GitHub 上 revert PR #80
gh pr comment 80 --body "需要回滚，发现严重问题：<描述问题>"

# 创建 revert PR
git checkout main
git pull origin main
git revert <merge_commit_sha>
git push origin main
```

### 2. 回滚数据库

```bash
# 删除新表（如果数据不重要）
psql $DATABASE_URL -c "DROP TABLE IF EXISTS prd_feedbacks CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS prd_snapshots CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS rag_retrieval_logs CASCADE;"

# 或者恢复完整备份
psql $DATABASE_URL < backup_v0.4.0_<timestamp>.sql
```

### 3. 清理 Redis 缓存

```bash
redis-cli -u $REDIS_URL FLUSHDB
```

---

## 📝 迁移完成检查清单

- [ ] 数据库备份已创建并验证
- [ ] 3 个新表已成功创建（prd_feedbacks, prd_snapshots, rag_retrieval_logs）
- [ ] prd_documents 表的 'default' 工作区数据已迁移
- [ ] documents 表的 'default' 工作区数据已迁移
- [ ] Redis 缓存已清理
- [ ] PRD 反馈功能测试通过
- [ ] PRD 版本快照功能测试通过
- [ ] RAG 检索质量面板正常显示
- [ ] Webhook 管理界面正常工作
- [ ] 原型主题定制功能正常
- [ ] Sentry 无新增严重错误
- [ ] Vercel 部署日志无异常

---

## 📞 联系方式

如果迁移过程中遇到问题，请：

1. 立即停止迁移
2. 记录详细错误信息
3. 检查 Sentry 和 Vercel 日志
4. 如有必要，执行回滚计划

---

**最后更新**: 2026-03-02
**版本**: v0.4.0
**负责人**: <填写负责人>
