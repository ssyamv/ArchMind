# v0.4.0 生产环境迁移报告

**执行时间**: 2026-03-02 18:30 (UTC+8)
**执行人**: Claude Sonnet 4.6
**状态**: ✅ 成功完成

---

## 📋 迁移摘要

### 1. Vercel 部署状态

- **状态**: ✅ 成功
- **部署 URL**: https://arch-mind-kjswe1tcn-ssyamvs-projects.vercel.app
- **部署时间**: ~3 分钟
- **CI 检查**: 全部通过（Lint、TypeCheck、Tests、Build）

### 2. 数据库迁移

#### 2.1 新表创建

| 表名 | 状态 | 大小 | 说明 |
|------|------|------|------|
| `prd_feedbacks` | ✅ 成功 | 40 kB | PRD 用户反馈打分（1-5 星 + 评论）|
| `prd_snapshots` | ✅ 成功 | 32 kB | PRD 版本快照（auto + manual）|
| `rag_retrieval_logs` | ✅ 成功 | 40 kB | RAG 检索质量日志 |

#### 2.2 索引创建

| 索引 | 状态 |
|------|------|
| `idx_prd_feedbacks_prd_id` | ✅ 成功 |
| `idx_prd_feedbacks_user_id` | ✅ 成功 |
| `idx_prd_snapshots_prd_created` | ✅ 成功 |
| `idx_prd_snapshots_type` | ✅ 成功 |
| `idx_rag_logs_workspace_created` | ✅ 成功 |
| `idx_rag_logs_document_ids` (GIN) | ✅ 成功 |

#### 2.3 数据清理

- **prd_documents 表**: ✅ 无脏数据（workspace_id 已是 UUID 类型）
- **documents 表**: ✅ 无脏数据（workspace_id 已是 UUID 类型）

**结论**: 数据库已经是干净状态，无需手动清理。

### 3. Redis 缓存清理

- **状态**: ✅ 成功
- **操作**: 执行 `FLUSHDB` 清空所有缓存
- **原因**: RAG 检索策略已变更（动态阈值），需清理旧缓存

### 4. 监控配置

- **Sentry**: ✅ 已配置
- **DSN**: https://62bf0539a1efd91965293ebac1a3e2de...

---

## ✅ 功能验证清单

### 已验证项

- [x] 数据库连接正常
- [x] 3 个新表创建成功
- [x] 6 个索引创建成功
- [x] 数据库无脏数据
- [x] Redis 缓存已清理
- [x] Sentry 监控已配置

### 待用户验证项

- [ ] PRD 反馈功能（访问 PRD 详情页，测试 1-5 星评分）
- [ ] PRD 版本快照（生成 PRD 时点击"保存版本"）
- [ ] PRD 版本对比（访问 `/prd-compare?left=<id1>&right=<id2>`）
- [ ] RAG 检索质量面板（工作区设置 → RAG 质量 Tab）
- [ ] Webhook 管理界面（工作区设置 → Webhooks Tab）
- [ ] 原型主题定制（生成原型时选择主题）

---

## 📊 数据库统计

### 表结构验证

```sql
-- prd_feedbacks 表结构
CREATE TABLE public.prd_feedbacks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id      UUID NOT NULL REFERENCES public.prd_documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  positives   TEXT[],
  negatives   TEXT[],
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prd_id, user_id)
);

-- prd_snapshots 表结构
CREATE TABLE public.prd_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id        UUID NOT NULL REFERENCES public.prd_documents(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(10) NOT NULL DEFAULT 'auto' CHECK (snapshot_type IN ('auto', 'manual')),
  tag           VARCHAR(200),
  description   TEXT,
  content       TEXT NOT NULL,
  content_size  INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- rag_retrieval_logs 表结构
CREATE TABLE public.rag_retrieval_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID,
  user_id           UUID,
  query_hash        TEXT NOT NULL,
  document_ids      UUID[],
  similarity_scores FLOAT[],
  strategy          TEXT,
  threshold         FLOAT,
  result_count      INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔍 遇到的问题与解决方案

### 问题 1: Schema 未设置

**现象**: 执行迁移 SQL 时报错 `no schema has been selected to create in`

**原因**: 生产数据库的 `search_path` 为空

**解决方案**: 在所有 SQL 语句前添加 `SET search_path TO public;`，并在表名前显式指定 `public.` schema

### 问题 2: 环境变量文件格式错误

**现象**: `source .vercel/.env.production.local` 报错 `parse error near '&'`

**原因**: 环境变量值中包含特殊字符（如 `&`），未正确转义

**解决方案**: 使用 `grep` 提取 `DATABASE_URL` 并通过 `export` 设置，避免直接 source 整个文件

---

## 📝 后续建议

### 1. 监控关注点

- **Sentry 错误日志**: 关注新 API 端点的错误（`/api/v1/prd/:id/feedback`、`/api/v1/prd/:id/snapshots` 等）
- **数据库性能**: 监控新表的查询性能，特别是 `rag_retrieval_logs` 的 GIN 索引
- **Redis 缓存命中率**: 清理后需要重新预热缓存

### 2. 功能测试建议

1. **PRD 反馈功能**
   - 创建一个测试 PRD
   - 提交 1-5 星评分和评论
   - 验证评分显示在 PRD 详情页

2. **PRD 版本管理**
   - 生成一个 PRD
   - 点击"保存版本"创建手动快照
   - 修改 PRD 内容后再次保存
   - 访问版本历史，对比两个版本

3. **RAG 检索质量**
   - 访问工作区设置 → RAG 质量 Tab
   - 验证统计数据正常显示
   - 执行几次文档检索，观察日志记录

4. **Webhook 管理**
   - 访问工作区设置 → Webhooks Tab
   - 创建一个测试 Webhook
   - 触发事件（如上传文档），验证投递日志

### 3. 性能优化建议

- **RAG 检索日志**: 考虑定期清理旧日志（如保留最近 30 天）
- **PRD 快照**: 自动快照可能会快速增长，建议设置保留策略（如最多保留 10 个 auto 快照）

---

## 🎉 迁移完成

v0.4.0 生产环境迁移已成功完成！所有数据库表和索引已创建，Redis 缓存已清理，系统已准备好使用新功能。

**下一步**: 请访问生产环境并测试上述功能，如有任何问题请查看 Sentry 错误日志。

---

**报告生成时间**: 2026-03-02 18:35 (UTC+8)
**版本**: v0.4.0
**GitHub Release**: https://github.com/ssyamv/ArchMind/releases/tag/v0.4.0
