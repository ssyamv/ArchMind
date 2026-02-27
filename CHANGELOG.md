# 变更日志

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

---

## [0.2.1] - 2026-02-26

本版本为 v0.2.0 发布后的系统性代码 Review 修复版，涵盖安全加固、稳定性修复和数据库兼容性修复。

### 安全 (Security)

- **工作区权限隔离** (`server/utils/auth-helpers.ts`): 新增 `requireWorkspaceMember()` 辅助函数，验证当前用户是否属于目标工作区。6 个工作区 API 端点从仅校验登录状态升级为同时校验成员身份和角色权限：
  - `GET /api/v1/workspaces/:id` — 要求 member
  - `PATCH /api/v1/workspaces/:id` — 要求 admin
  - `DELETE /api/v1/workspaces/:id` — 要求 owner
  - `GET /api/v1/workspaces/:id/members` — 要求 member
  - `POST /api/v1/workspaces/:id/members/invite` — 要求 admin
  - `DELETE /api/v1/workspaces/:id/members/:userId` — 要求 admin
- **JWT 弱默认密钥修复** (`server/utils/jwt.ts`): 生产环境（`NODE_ENV=production`）未设置 `JWT_SECRET` 时启动即报错退出，防止使用可预测的默认密钥签发 Token
- **API Key 加密密钥修复** (`lib/db/dao/user-api-config-dao.ts`): 生产环境未设置 `API_KEY_ENCRYPTION_SECRET` 时启动即报错退出，开发环境打印明确警告
- **PRD 内容 XSS 修复** (`pages/projects/[id].vue`): `v-html` 渲染前通过 DOMPurify 净化 `marked()` 输出，仅允许安全的 HTML 标签与属性

### 修复 (Fixed)

- **统计接口用户隔离** (`server/api/v1/stats/index.get.ts`): 向量数统计从全系统聚合改为按当前用户隔离，避免泄露其他用户的文档数量
- **分享令牌日志脱敏** (`server/api/v1/share/[token].get.ts`): 访问日志只记录令牌前 8 位，防止完整令牌写入日志文件
- **分页参数无上限** (`server/api/v1/documents/index.get.ts`): `limit` 参数增加 `max(100)` 限制，防止单次拉取过多数据
- **邀请接口速率限制** (`server/middleware/02.rate-limit.ts`): 为 `/api/v1/invitations/*` 端点单独配置 5 次/分钟限流，防止令牌暴力枚举
- **AI 适配器空 choices 崩溃** (`lib/ai/adapters/openai.ts`、`deepseek.ts`、`glm.ts`、`qwen.ts`、`ollama.ts`): 所有适配器在 `generateText` 和 `generateStream` 中对空 `choices` 数组做防护，抛出明确错误而非 TypeError
- **ModelManager 初始化竞态** (`lib/ai/manager.ts`): `getModelManager()` 有配置变更时原子替换实例，消除 `clear()` 与填充之间的中间状态
- **localStorage 数据损坏崩溃** (`composables/useConversation.ts`): `loadFromStorage` 增加 `try-catch`，损坏数据自动清除并继续正常工作
- **localStorage 写入配额溢出** (`composables/useConversation.ts`、`composables/useWorkspace.ts`、`components/chat/MessageInput.vue`): `setItem` 调用增加 try-catch，存储满时打印警告而非静默失败
- **RAG Switch 控件无响应** (`pages/projects/[id].vue`): `Switch` 组件绑定从 `:checked` / `@update:checked` 更正为 `:model-value` / `@update:model-value`
- **PRD 索引缺失数据库表** (`scripts/init-db.ts`、新增 `migrations/add-prd-chunks-table.sql`): `prd_chunks` 表已编码但从未创建，导致"直接索引"功能报 `relation "prd_chunks" does not exist` 错误
- **PRD 向量写入外键约束冲突** (`migrations/drop-document-embeddings-chunk-fk.sql`): `document_embeddings.chunk_id` 的外键约束只允许引用 `document_chunks(id)`，导致 PRD 向量化写入 `prd_chunks.id` 时报 FK 违约；删除该约束，`chunk_id` 改为无约束 UUID，同时支持文档块和 PRD 块两种来源

### 改进 (Changed)

- **向量批次维度一致性校验** (`lib/db/dao/vector-dao.ts`): 批量插入向量时检查所有 chunk 的 `dimensions` 字段是否一致，不一致时提前抛出明确错误
- **`stores/prd.ts` 类型安全**: 移除 `as any` 强转，定义 `PRDListResponse` / `PRDDetailResponse` 接口，修正 API 路径为 `/api/v1/prd`

### 数据库迁移

现有数据库需按顺序执行以下迁移脚本：

```bash
# 1. 创建 prd_chunks 表（PRD 知识库分块存储）
npx tsx scripts/migrate-add-prd-chunks.ts

# 2. 移除 document_embeddings 外键约束（兼容 PRD 向量）
psql $DATABASE_URL -f migrations/drop-document-embeddings-chunk-fk.sql
```

---

## [0.2.0] - 2026-02-25

### 新增

#### 安全加固

- **Rate Limiting 中间件** (`server/middleware/02.rate-limit.ts`): 基于内存 Map 的 IP + 路径级别请求频率限制，无需 Redis 依赖
  - 认证端点（`/api/auth/login|register|forgot-password|reset-password`）：10 次/分钟
  - AI 生成端点（`/api/prd/stream`、`/api/prototypes/stream`、`/api/chat/stream` 等）：20 次/分钟
  - 其他 API 端点：120 次/分钟
  - 超限返回 HTTP 429，响应头携带 `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`、`Retry-After`
  - 每 5 分钟自动清理过期条目，防止内存泄漏

- **CSRF 保护中间件** (`server/middleware/03.csrf.ts`): 基于 Origin/Referer 校验的跨站请求伪造防护
  - 对所有写操作（POST/PUT/PATCH/DELETE）校验请求来源与 Host 是否匹配
  - 开发模式（`NODE_ENV !== 'production'`）自动放宽，不影响本地开发体验
  - 豁免路径：`/api/health`、`/api/share/*`（公开端点）
  - Origin 优先，回退 Referer，均无时拒绝请求

- **中间件执行顺序规范化**: 所有服务端中间件添加数字前缀，明确执行顺序
  - `00.logger.ts` → 请求日志
  - `01.auth.ts` → JWT 认证
  - `02.rate-limit.ts` → 请求限流
  - `03.csrf.ts` → CSRF 保护

#### 混合搜索 RRF 正式启用

- **`retrieve()` 默认使用混合搜索**：`RAGRetriever.retrieve()` 默认策略从纯向量改为 RRF（Reciprocal Rank Fusion）混合搜索，可通过 `ragStrategy: 'vector'` 退回纯向量
- **`keywordSearch()` 支持中文**：自动检测查询语言，中文使用 PostgreSQL `simple` 全文配置（逐字索引），英文使用 `english`（词干化）
- **`keywordSearch()` 支持 documentIds 过滤**：新增第 4 个参数 `documentIds`，允许在指定文档范围内进行关键词搜索
- **`hybridSearch()` 支持 documentIds 传递**：`documentIds` 过滤条件同时传递给关键词搜索和向量检索两个子查询，保证范围一致性
- **PRDGenerator 传递 userId**：`generate()` 和 `generateStream()` 中 RAG 检索时正确传递 `userId`，修复用户数据隔离逻辑
- **ChatEngine PRD 路径标注策略**：PRD 路径明确指定 `ragStrategy: 'vector'`，文档路径使用混合搜索，语义更清晰

#### 测试覆盖

- **Rate Limiting 单元测试** (`tests/unit/server/middleware/rate-limit.test.ts`): 22 个测试用例，覆盖规则匹配、限流逻辑、窗口重置、IP 隔离等场景
- **CSRF 单元测试** (`tests/unit/server/middleware/csrf.test.ts`): 21 个测试用例，覆盖安全方法放行、豁免路径、Origin/Referer 校验、开发模式等场景
- **RAGRetriever 单元测试** (`tests/unit/lib/rag/retriever.test.ts`): 20 个测试用例，覆盖策略路由、混合搜索并行调用、中文语言检测、documentIds 过滤等

#### 异步批量上传队列（fix #4）

- **批量上传改为异步队列**: `server/api/v1/documents/batch-upload.post.ts` 立即返回 `taskId`，后台异步执行文档解析 → 分块 → 向量化全流程
- **任务状态查询接口**: `GET /api/v1/documents/tasks/:taskId` 支持前端轮询处理进度
- **失败重试与错误信息**: 任务失败时记录详细错误原因并更新任务状态

#### SSE 文档处理进度实时推送（fix #12）

- **SSE 进度端点**: `GET /api/v1/documents/:id/events` 实时推送文档处理阶段（parsing → chunking → embedding → done）
- **前端进度条组件**: `components/documents/DocumentUpload.vue` 集成 `EventSource`，展示实时进度与阶段文字说明
- **连接自动关闭**: 处理完成或失败后服务端自动发送 `done` 事件，前端关闭连接

#### API 版本控制（fix #9）

- **路由迁移至 `/api/v1/`**: 所有服务端 API 路由从 `server/api/` 迁移至 `server/api/v1/`，建立版本控制基础
- **前端 API 调用同步更新**: 所有 composables 和页面组件的 `$fetch` 路径更新为 `/api/v1/` 前缀
- **中间件路径更新**: `rate-limit.ts`、`auth.ts` 等中间件的路径匹配规则同步更新为 `/api/v1/`

#### PRD 导出 PDF/Word（fix #10）

- **导出 API**: `GET /api/v1/prd/:id/export?format=pdf|docx` 支持导出完整 PRD 内容
- **Word 导出**: 使用 `docx` 库生成结构化 `.docx` 文件，包含标题、章节和引用来源
- **PDF 导出**: 服务端渲染 HTML 后转换为 PDF 二进制流返回
- **前端导出按钮**: PRD 详情页顶部添加导出 `DropdownMenu`，支持 PDF/Word 格式选择与下载进度提示
- **文件命名**: 格式为 `PRD-{title}-{YYYY-MM-DD}.pdf/docx`

#### 对话历史搜索（fix #11）

- **搜索 API**: `GET /api/v1/conversations/search?q=keyword&workspaceId=xxx` 支持按关键词全文检索对话标题与消息内容
- **PostgreSQL 全文检索**: 利用现有 GIN 索引，中文使用 `simple` 配置（逐字），英文使用 `english`（词干化），支持分页
- **前端搜索框**: 对话侧边栏顶部新增搜索输入框，防抖 300ms 触发，结果中关键词高亮显示
- **空状态处理**: 无搜索结果时展示友好提示

#### 工作区成员邀请（fix #13）

- **邀请 API 完整流程**:
  - `POST /api/v1/workspaces/:id/members/invite` — 发起邀请，生成 7 天有效期 Token 并发送邮件
  - `GET /api/v1/invitations/:token` — 查询邀请信息（邀请人、工作区名称、有效期）
  - `POST /api/v1/invitations/:token/accept` — 接受邀请，加入工作区
  - `DELETE /api/v1/workspaces/:id/members/:userId` — 移除成员
  - `GET /api/v1/workspaces/:id/members` — 获取成员列表
- **邀请接受页面**: `pages/invite/[token].vue` 展示邀请详情，支持登录后一键接受
- **邮件通知**: `server/utils/email.ts` 封装邮件发送工具，支持邀请邮件模板
- **WorkspaceSwitcher 成员管理**: 工作区切换器新增成员列表展示与邀请入口
- **数据库迁移**: `migrations/add-workspace-members-invitations.sql` 新增 `workspace_invitations` 表（含 token、邮箱、状态、过期时间字段）

#### 测试覆盖率提升（fix #8）

- **覆盖率从 15% 提升至 89%**: 补充核心模块单元测试，超额完成 60% 目标
- **新增测试模块**:
  - `lib/rag/` — document-processor、retriever、text-splitter、embeddings（共 60+ 用例）
  - `lib/prd/` — generator、template（共 30+ 用例）
  - `lib/db/dao/` — document-dao、prd-dao、workspace-dao 等（共 50+ 用例）
  - `lib/ai/adapters/` — 各模型适配器 Mock 测试（共 40+ 用例）
  - `server/api/` — 文档、PRD、认证相关 API 集成测试（共 50+ 用例）

#### 其他基础设施

- **Sentry 错误监控（fix #5）**: 接入 `@sentry/nuxt`，前后端全链路错误追踪，关联 `reqId`，Source Map 自动上传
- **Redis 缓存层（fix #6）**: `lib/cache/` 统一缓存模块，支持 Redis（`REDIS_URL`）/ 内存降级；RAG 检索结果缓存 TTL 10min，AI 模型列表缓存 TTL 1h
- **混合搜索 RRF 优化（fix #7）**: RRF 参数可配置（k 值），引入加权融合策略，添加 MRR/NDCG 检索质量评估指标与 A/B 对比脚本

### 修复

- **Vercel 生产错误修复**:
  - 文件上传临时目录 ENOENT：`/var/task/tmp` → 正确使用 `/tmp`（修复 `path.join` 拼接绝对路径的问题）
  - `/api/stats` 持续 500：`VectorDAO.count()` 在 `document_embeddings` 表未迁移时优雅降级返回 `0`（捕获 pg 错误码 `42P01`）
  - pg SSL 安全警告：将 `sslmode` 字符串依赖改为显式 `{ rejectUnauthorized: true }` 配置

### 变更

- `package.json` 版本号更新至 `0.2.0`
- `lib/db/schema.sql` 补充 `document_embeddings` 表定义
- GitHub Branch Protection：`develop` 和 `main` 分支启用 `enforce_admins=true`，管理员也无法绕过 CI 检查合并 PR

---

## [0.1.2] - 2026-02-24

### 新增

#### 后端结构化日志系统
- **统一日志模块** (`lib/logger.ts`): 基于 pino 实现结构化 JSON 日志，支持 `LOG_LEVEL` 环境变量控制输出级别（`trace | debug | info | warn | error | silent`），测试环境自动静默
- **HTTP 请求日志中间件** (`server/middleware/00.logger.ts`): 记录每个 API 请求的方法、路径、状态码、耗时、IP、userId，注入 `reqId`（nanoid 12位）用于请求追踪
- **模块化 child logger**: 预定义 `ragLogger`、`prdLogger`、`aiLogger`、`authLogger`、`dbLogger`、`storageLogger`，按模块分类日志便于过滤
- **替换业务模块 console 调用**: `lib/db/client.ts`、`lib/ai/manager.ts`、`lib/rag/pipeline.ts`、`lib/rag/embedding-adapter.ts`、`lib/storage/storage-factory.ts`、`lib/storage/adapters/huawei-obs-adapter.ts` 中的 console.* 统一替换为结构化日志

#### Git 工作流规范
- **husky pre-push hook** (`.husky/pre-push`): 推送到 main 分支前强制运行 lint + typecheck + test，本地拦截破损代码
- **GitHub Branch Protection Rules**: 设置 main 分支保护，要求 PR 合并且 CI 全部通过（`Lint & Type Check`、`Unit Tests`、`Build`）
- **CLAUDE.md Git Flow 规范**: 新增 Section 0，涵盖提交确认流程、分支策略（main/develop/feature/fix/release）、Conventional Commits 规范、版本发布流程

#### UI 安全改进
- **AlertDialog 替换 window.confirm()**: `pages/settings/profile.vue` 删除操作改用 shadcn/ui `AlertDialog`，符合项目 UI 规范

### 变更
- `package.json` 添加 `"prepare": "husky"` 确保团队成员 `pnpm install` 后自动激活 git hooks
- `.env.example` 新增 `LOG_LEVEL` 配置项说明

### 修复
- 修复 `package.json` 中 `"prepare"` 字段重复的问题（husky init 导致）

---

## [0.1.1] - 2026-02-24

### 新增

#### 认证与安全
- **全局认证中间件** (`server/middleware/01.auth.ts`): 统一拦截所有 `/api/` 请求并验证 JWT，确保所有受保护端点强制认证
- **认证工具函数** (`server/utils/auth-helpers.ts`): 提供 `requireAuth()` 和 `requireResourceOwner()` 两个复用工具，简化各端点的权限检查逻辑

#### 用户级 AI 配置隔离
- **每个用户独立的 AI 提供商配置**: `user_api_configs` 表新增 `user_id` 关联字段，实现真正的多租户数据隔离
- **用户自选模型列表**: `user_api_configs` 表新增 `models` (JSONB) 字段，用户可为每个提供商自定义启用的模型 ID 列表
- **数据库唯一约束升级**: 从单列 `(provider)` 唯一约束升级为联合 `(user_id, provider)` 约束

#### AI 模型配置 UI 重构
- **模型配置整合至 Profile 页面**: 将原独立的 `pages/settings/models.vue` 整合为 `pages/settings/profile.vue` 的 "Models" Tab，UX 结构更统一
- **动态模型列表获取**: 验证 API 连接时自动从提供商获取真实可用模型列表（支持 OpenAI、Anthropic、Gemini、DeepSeek、Ollama）
- **模型选择界面**: 可滚动列表支持勾选/取消模型，支持手动添加自定义模型 ID

#### API 适配器增强
- **自定义 Base URL 支持**: 所有 AI 适配器（Claude、OpenAI、GLM、DeepSeek 等）现支持自定义 `baseUrl`，便于使用 API 中转站或自建代理

### 变更

#### 数据库
- `user_api_configs` 表添加 `user_id` 外键（关联 `users` 表）和 `models` JSONB 字段
- 新增数据库迁移文件: `migrations/add-user-data-isolation.sql`、`migrations/add-user-model-selection.sql`

#### API 层
- `UserAPIConfigDAO` 所有方法均添加 `userId` 参数，实现按用户查询隔离
- `GET /api/ai/models` 升级为三层模型来源（系统环境变量 / 用户配置 / 动态获取），用户自定义模型 ID 加 `user:` 前缀以区分来源
- `POST /api/ai/configs/validate` 新增动态获取提供商模型列表能力，返回 `modelsFetched` 标志

#### 类型定义
- `UserAPIConfig` 新增 `models?: string[]` 字段
- `SaveAPIConfigRequest` 新增 `models?: string[]` 字段
- `ValidateAPIResponse` 新增 `modelsFetched?: boolean` 标志
- `PRDGenerateRequest` 新增 `modelId?: string` 明确指定模型 ID

### 移除
- `pages/settings/models.vue` - 模型配置页面已整合至 `pages/settings/profile.vue`

### 修复
- 历史数据兼容: `user_id` 为 null 的旧配置记录对所有已登录用户可见，保持向后兼容

---

## [0.1.0] - 2026-02-16

### 新增

#### 核心功能
- **文档管理系统**: 支持 PDF、DOCX、Markdown 格式文档的上传、处理和管理
- **RAG 引擎**: 基于向量检索的文档问答和内容检索
- **PRD 生成**: 基于历史文档智能生成产品需求文档
- **对话系统**: 支持多轮对话的 AI 助手功能
- **原型预览**: PRD 原型的可视化预览

#### AI 多模型支持
- **Anthropic Claude**: Claude 3.5 Sonnet 支持
- **OpenAI**: GPT-4o、GPT-4 Turbo 支持
- **Google**: Gemini 1.5 Pro 支持 (200K 上下文)
- **智谱 AI**: GLM-4、GLM-4.5 Air 支持
- **阿里云**: 通义千问 (Qwen) 支持
- **百度**: 文心一言 (Wenxin) 支持
- **DeepSeek**: DeepSeek Chat 支持
- **Ollama**: 本地模型支持

#### 文档处理
- 文档版本控制系统
- SHA-256 智能去重
- 批量上传 (并行处理)
- 文档处理进度追踪
- 标签和分类管理

#### 搜索功能
- PostgreSQL 全文检索 (tsvector + GIN)
- pgvector 向量检索
- 混合搜索 (RRF 算法融合)

#### 对象存储
- 华为云 OBS 存储适配器
- 统一存储抽象层
- 预签名 URL 下载

#### 用户系统
- JWT 认证
- 用户注册/登录
- 多工作区支持
- 用户 API Key 配置

#### UI 组件
- shadcn/ui 组件库集成 (30+ 组件)
- Tailwind CSS 样式
- 深色模式支持
- 响应式设计

### 技术栈
- Nuxt 3.21 + Vue 3.5 + TypeScript 5.9
- PostgreSQL 14+ + pgvector
- Drizzle ORM
- Pinia 状态管理
- VeeValidate + Zod 表单验证
- LangChain.js
- Vitest 测试框架

---

## [0.0.1] - 2026-02-01

### 新增
- 项目初始化
- 基础项目结构
- Nuxt 3 框架配置
- 基本的文档处理流程

---

## 版本规划

### [0.2.0] - 已完成 ✅

#### 新增
- [x] 混合搜索优化 (RRF 重排序)
- [x] API 版本控制 (v1)
- [x] 监控和告警 (Sentry)
- [x] 审计日志

#### 改进
- [x] 测试覆盖率提升至 89%
- [x] 安全加固 (CSRF, Rate Limiting)

### [0.2.1] - 已完成 ✅

- [x] 工作区权限隔离（6 个 API 端点）
- [x] JWT / API Key 弱密钥生产环境强制检查
- [x] PRD 内容 XSS 防护
- [x] PRD 知识库索引功能修复（prd_chunks 表 + FK 约束）
- [x] AI 适配器空 choices 崩溃修复
- [x] localStorage 健壮性修复

### [0.3.0] - 计划中

#### 新增
- [x] WebSocket 实时通信
- [x] 团队协作功能
- [x] Webhook 支持（HMAC-SHA256 签名、投递日志、5 个 REST 端点）
- [x] OpenAPI 文档自动生成
- [x] 国际化 (i18n) 完善（补全 7 个英文缺失键，zh-CN 与 en 完全对齐）

#### 改进
- [x] E2E 测试覆盖（修复 3 个 CI 失败用例）
- [x] CI/CD 流程
- [x] Docker Compose 生产配置（`docker-compose.prod.yml`：预构建镜像、端口隔离、资源限制、Redis AOF 持久化）

### [1.0.0] - 计划中

#### 新增
- [ ] RBAC 权限系统
- [ ] 数据导出/导入
- [ ] 批量操作 API
- [ ] 插件系统
- [ ] Kubernetes 部署配置

---

## 版本说明

### 版本号格式

- **主版本号 (MAJOR)**: 不兼容的 API 变更
- **次版本号 (MINOR)**: 向后兼容的功能新增
- **修订号 (PATCH)**: 向后兼容的问题修复

### 变更类型

- **新增 (Added)**: 新功能
- **变更 (Changed)**: 现有功能的变更
- **弃用 (Deprecated)**: 即将移除的功能
- **移除 (Removed)**: 已移除的功能
- **修复 (Fixed)**: Bug 修复
- **安全 (Security)**: 安全相关的修复

---

*最后更新: 2026-02-26*
