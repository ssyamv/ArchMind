# 生产环境紧急修复：Webhook Type 字段缺失

## 问题描述

**错误信息**：
```
error: column "type" does not exist
at /var/task/chunks/nitro/nitro.mjs:12112:20
```

**影响范围**：
- API 端点：`GET /api/v1/workspaces/:id/webhooks`
- 错误码：500
- 发生时间：2026-03-02 16:36:18 UTC

**根本原因**：
v0.4.0 的 #60 功能（Webhook 前端管理）新增了 `webhooks.type` 字段，但生产数据库未执行迁移 SQL。

---

## 修复步骤

### 1. 连接生产数据库

```bash
# 从 Vercel 环境变量获取数据库连接
vercel env pull .vercel/.env.production.local

# 或直接使用 DATABASE_URL
psql "$DATABASE_URL"
```

### 2. 执行迁移 SQL（幂等性保证）

```sql
-- 添加 type 字段（如果不存在）
ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'standard'
    CHECK (type IN ('standard', 'feishu', 'dingtalk', 'wecom', 'slack', 'discord'));

-- 验证字段已添加
\d webhooks
```

### 3. 验证修复

```sql
-- 查询现有 webhook 记录（应该全部显示 type = 'standard'）
SELECT id, name, type, active FROM webhooks LIMIT 5;
```

### 4. 重新部署（可选）

如果已经部署了包含 schema.ts 修复的版本，无需重新部署。
否则合并 PR 后触发自动部署。

---

## 预防措施

### 1. 迁移检查清单

在每次版本发布前，确认以下事项：

- [ ] 所有 `migrations/*.sql` 文件已在生产数据库执行
- [ ] `lib/db/schema.ts` 与迁移 SQL 保持一致
- [ ] 本地运行 `pnpm db:migrate` 测试迁移脚本
- [ ] 在 staging 环境验证迁移

### 2. 自动化迁移脚本

建议在 CI/CD 流程中添加迁移检查：

```yaml
# .github/workflows/deploy.yml
- name: Check pending migrations
  run: |
    # 比对 migrations/ 目录与数据库 schema_migrations 表
    pnpm db:check-migrations
```

### 3. Schema 一致性测试

添加单元测试验证 schema.ts 与数据库表结构一致：

```typescript
// tests/db/schema-consistency.test.ts
describe('Schema Consistency', () => {
  it('webhooks table should have type column', async () => {
    const result = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'webhooks' AND column_name = 'type'
    `)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].data_type).toBe('character varying')
  })
})
```

---

## 相关文件

- 迁移 SQL：`migrations/add-webhook-type.sql`
- Schema 定义：`lib/db/schema.ts:430-446`
- DAO 层：`lib/db/dao/webhook-dao.ts`
- 修复分支：`fix/webhook-type-column-missing`

---

## 时间线

| 时间 | 事件 |
|------|------|
| 2026-03-02 16:36 | 生产环境报错，用户无法访问 Webhook 管理页面 |
| 2026-03-03 | 发现 schema.ts 缺少 type 字段定义 |
| 2026-03-03 | 创建修复分支并提交 PR |
| 待定 | 执行生产数据库迁移 |
| 待定 | 合并 PR 并部署 |

---

*创建时间：2026-03-03*
*负责人：Claude Code*
