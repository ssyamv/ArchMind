# 变更日志

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### 新增
- 待发布功能...

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

### [0.2.0] - 计划中

#### 新增
- [ ] 混合搜索优化 (重排序机制)
- [ ] Redis 缓存层
- [ ] API 版本控制 (v1)
- [ ] 监控和告警 (Sentry)
- [ ] 审计日志

#### 改进
- [ ] 测试覆盖率提升至 60%+
- [ ] 性能优化 (数据库查询)
- [ ] 安全加固 (CSRF, Rate Limiting)

### [0.3.0] - 计划中

#### 新增
- [ ] WebSocket 实时通信
- [ ] 团队协作功能
- [ ] Webhook 支持
- [ ] OpenAPI 文档自动生成
- [ ] 国际化 (i18n) 完善

#### 改进
- [ ] E2E 测试覆盖
- [ ] CI/CD 流程
- [ ] Docker Compose 生产配置

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

*最后更新: 2026-02-24*
