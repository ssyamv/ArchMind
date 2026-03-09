# 生产环境部署检查清单

> 在每次部署到生产环境前，必须完成以下所有检查项

## 1. 数据库迁移检查 ✅

### 1.1 本地验证

```bash
# 1. 在本地测试数据库上运行迁移
pnpm migrate up

# 2. 检查迁移状态
pnpm migrate status

# 3. 验证所有迁移已执行
# 输出应显示 "待执行的迁移: 0 个"
```

### 1.2 生产环境迁移

```bash
# 1. 连接到生产数据库
export DATABASE_URL="postgresql://user:pass@prod-host:5432/archmind"

# 2. 备份数据库（必须！）
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# 3. 查看待执行迁移
pnpm migrate status

# 4. 执行迁移
pnpm migrate up

# 5. 验证迁移结果
pnpm migrate status
psql $DATABASE_URL < scripts/audit-production-schema.sql
```

### 1.3 回滚计划

如果迁移失败，执行以下步骤：

```bash
# 1. 恢复备份
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql

# 2. 检查数据完整性
psql $DATABASE_URL -c "SELECT COUNT(*) FROM documents;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM prd_documents;"

# 3. 通知团队并调查失败原因
```

---

## 2. 代码部署检查 ✅

### 2.1 CI/CD 状态

- [ ] 所有 CI 检查通过（Lint, TypeCheck, Unit Tests, E2E Tests, Build, Schema Check）
- [ ] 单元测试覆盖率 ≥ 85%
- [ ] E2E 测试通过（`pnpm test:e2e`，至少无 fail，flaky 可接受）
- [ ] 无高危安全漏洞（Security Audit）
- [ ] Docker 镜像构建成功（如适用）

### 2.2 环境变量

```bash
# 验证生产环境变量完整性
vercel env ls production

# 必需的环境变量：
# - DATABASE_URL
# - JWT_SECRET
# - ENCRYPTION_KEY
# - STORAGE_PROVIDER
# - HUAWEI_OBS_* (如使用华为云 OBS)
# - AI 模型 API Keys (ANTHROPIC_API_KEY, OPENAI_API_KEY 等)
```

### 2.3 依赖版本

```bash
# 检查 package.json 和 pnpm-lock.yaml 是否同步
pnpm install --frozen-lockfile

# 验证关键依赖版本
pnpm list nuxt @langchain/openai drizzle-orm postgres
```

---

## 3. 功能验证 ✅

### 3.1 核心功能测试

部署后在生产环境执行以下测试：

| 功能 | 测试步骤 | 预期结果 |
|------|----------|----------|
| 用户认证 | 登录/注册 | 成功获取 JWT token |
| 文档上传 | 上传 PDF/DOCX | 文档解析成功，向量化完成 |
| RAG 检索 | 搜索关键词 | 返回相关文档块 |
| PRD 生成 | 创建新 PRD | AI 生成成功，内容合理 |
| 对话功能 | 发送消息 | 实时响应，历史记录保存 |

### 3.2 性能测试

```bash
# 1. 检查 API 响应时间
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com/api/v1/health

# 2. 检查数据库连接池
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'archmind';"

# 3. 检查存储服务健康
pnpm storage:health
```

---

## 4. 监控与告警 ✅

### 4.1 日志检查

```bash
# Vercel 日志
vercel logs --follow

# 数据库慢查询
psql $DATABASE_URL -c "
  SELECT query, calls, mean_exec_time
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"
```

### 4.2 错误监控

- [ ] Sentry 错误追踪已配置
- [ ] 关键 API 端点已添加监控
- [ ] 数据库连接池监控已启用

---

## 5. 回滚准备 ✅

### 5.1 快速回滚

```bash
# 1. 回滚到上一个稳定版本
vercel rollback

# 2. 如需回滚数据库，恢复备份
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql

# 3. 验证回滚成功
curl https://your-domain.com/api/v1/health
```

### 5.2 通知机制

- [ ] 团队已知晓部署时间窗口
- [ ] 用户已收到维护通知（如需停机）
- [ ] 紧急联系人列表已更新

---

## 6. 部署后验证 ✅

### 6.1 健康检查

```bash
# 1. API 健康检查（含 DB 连通性）
npx vercel curl /api/v1/health --deployment <deployment-url>
# 预期: {"status":"ok","message":"ArchMind API 正在运行","timestamp":"..."}

# 2. 数据库连接
psql $DATABASE_URL -c "SELECT version();"

# 3. pgvector 扩展
psql $DATABASE_URL -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"
```

### 6.2 数据完整性

```bash
# 运行审计脚本
psql $DATABASE_URL < scripts/audit-production-schema.sql

# 检查脏数据（workspace_id 为 NULL 的记录）
psql $DATABASE_URL -c "SELECT COUNT(*) FROM prd_documents WHERE workspace_id IS NULL;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM documents WHERE workspace_id IS NULL;"
# 预期: 均为 0

# 检查核心表行数一致性
psql $DATABASE_URL -c "
  SELECT 'users' t, COUNT(*) n FROM users
  UNION ALL SELECT 'workspaces', COUNT(*) FROM workspaces
  UNION ALL SELECT 'workspace_members', COUNT(*) FROM workspace_members
  ORDER BY t;
"
# 预期: users 行数 = workspaces 行数 = workspace_members 行数（每用户一个 owner 工作区）
```

---

## 7. 常见问题排查

### 问题 1: 迁移未执行

**症状**: 生产环境报错 `column xxx does not exist`

**排查**:
```bash
# 1. 检查迁移状态
pnpm migrate status

# 2. 查看 schema_migrations 表
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY executed_at DESC LIMIT 10;"

# 3. 手动执行缺失的迁移
pnpm migrate up
```

### 问题 2: 环境变量缺失

**症状**: 应用启动失败或功能异常

**排查**:
```bash
# 1. 检查 Vercel 环境变量
vercel env ls production

# 2. 对比 .env.example
diff <(grep -v '^#' .env.example | cut -d= -f1 | sort) \
     <(vercel env ls production | tail -n +2 | awk '{print $1}' | sort)

# 3. 添加缺失的变量
vercel env add <VAR_NAME> production
```

### 问题 3: CI 检查失败

**症状**: PR 无法合并，CI 显示红色 ❌

**排查**:
```bash
# 1. 查看 CI 日志
gh run view <run-id> --log-failed

# 2. 本地复现
pnpm lint
pnpm typecheck
pnpm test

# 3. 修复后重新推送
git add .
git commit -m "fix: resolve CI issues"
git push
```

---

## 8. 部署记录模板

每次部署后填写以下记录：

```markdown
## 部署记录 - YYYY-MM-DD

### 基本信息
- 版本: vX.Y.Z
- 部署人: @username
- 部署时间: YYYY-MM-DD HH:MM:SS
- Git Commit: abc1234

### 变更内容
- [ ] 新功能 1
- [ ] Bug 修复 2
- [ ] 数据库迁移 3

### 迁移执行
- 迁移文件: 20260302_001-xxx.sql, 20260302_002-yyy.sql
- 执行时间: 2.3s
- 影响行数: 1234 rows

### 验证结果
- [ ] 健康检查通过
- [ ] 核心功能测试通过
- [ ] 性能指标正常
- [ ] 无错误日志

### 问题记录
- 无 / 问题描述及解决方案

### 回滚计划
- 备份文件: backup-20260302-143000.sql
- 回滚命令: vercel rollback
```

---

## 9. 自动化改进建议

### 9.1 Pre-deployment Hook

在 `.github/workflows/deploy.yml` 中添加：

```yaml
- name: Pre-deployment checks
  run: |
    pnpm migrate status
    pnpm test
    pnpm build
```

### 9.2 Post-deployment Verification

```yaml
- name: Post-deployment verification
  run: |
    curl -f https://your-domain.com/api/v1/health || exit 1
    psql $DATABASE_URL < scripts/audit-production-schema.sql
```

### 9.3 Slack 通知

```yaml
- name: Notify deployment
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ Deployment to production completed",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Version:* ${{ github.ref_name }}\n*Commit:* ${{ github.sha }}"
            }
          }
        ]
      }
```

---

*最后更新: 2026-03-09*
