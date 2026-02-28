# ArchMind AI

> 基于 RAG 技术的本地优先智能产品工具——让每一份历史文档都成为新功能的基础

[![Nuxt](https://img.shields.io/badge/Nuxt-3.21-00DC82?logo=nuxt.js)](https://nuxt.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org/)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.3.0-blue)](CHANGELOG.md)

---

## 目录

- [简介](#简介)
- [核心特性](#核心特性)
- [快速开始](#快速开始)
- [技术架构](#技术架构)
- [功能截图](#功能截图)
- [AI 模型支持](#ai-模型支持)
- [配置说明](#配置说明)
- [开发指南](#开发指南)
- [部署指南](#部署指南)
- [文档导航](#文档导航)
- [路线图](#路线图)
- [贡献指南](#贡献指南)
- [贡献者](#贡献者)

---

## 简介

**ArchMind AI** 是一个本地优先的智能产品工具，通过 RAG（检索增强生成）将企业历史文档转化为高质量 PRD 和可交互 HTML 原型。

### 为什么需要 ArchMind？

产品团队在迭代过程中面临的核心痛点：

- 历史文档分散，新功能设计时找不到参考
- 新产品经理需要大量时间理解历史业务逻辑
- 重复编写相似功能的 PRD，效率低下
- 原型制作耗费大量时间，难以快速验证想法

**ArchMind 的解决方案**：将所有历史文档统一管理，通过 AI 自动检索相关内容并辅助生成新的 PRD，消除产品迭代中的逻辑断层。

### 适用场景

- 产品经理快速生成结构化 PRD，参考历史功能设计
- 技术团队建立知识库，快速检索历史技术决策
- 新成员快速上手，理解历史业务逻辑
- 设计师参考历史 UI/UX 规范，保持一致性

---

## 核心特性

### 智能文档管理

- 支持 **PDF、DOCX、Markdown** 多格式上传
- **版本控制**：完整的文档版本历史，支持回退
- **智能去重**：SHA-256 哈希自动检测重复文档
- **批量上传**：并行处理，10 个文件约 8 秒完成
- **标签 & 分类**：灵活的文档组织体系
- **文档分享**：生成有时限预签名 URL

### 混合搜索引擎

| 搜索模式 | 技术实现 | 特点 |
|----------|----------|------|
| 关键词搜索 | PostgreSQL tsvector + GIN 索引 | 精确词语匹配 |
| 向量语义搜索 | pgvector + IVFFlat 索引 | 理解语义含义 |
| **混合搜索** | **RRF 算法融合** | **准确率提升 20%+** |

### AI 驱动的 PRD 生成

- **对话式生成**：自然语言描述需求，AI 智能补全
- **流式输出**：实时看到生成过程，无需等待
- **RAG 上下文**：自动检索最相关历史文档作为参考
- **多轮迭代**：持续对话优化 PRD 内容
- **引用追踪**：清晰显示生成 PRD 参考了哪些历史文档

### 原型与逻辑图

- **HTML 原型生成**：从 PRD 一键生成可交互 HTML 原型
- **多页原型**：支持多页应用原型，页面间可跳转
- **设备预览**：响应式/移动端/桌面端三种预览模式
- **Monaco 编辑器**：直接在浏览器中编辑原型代码
- **逻辑图生成**：自动生成 PRD 功能点的逻辑关系图
- **覆盖率分析**：量化 PRD 对需求的覆盖程度

### 实时协作（v0.3.0 新增）

- **WebSocket 实时通信**：Nitro 原生 WebSocket，鉴权通过 HttpOnly Cookie 在服务端完成
- **评论系统**：支持 @提及、评论解决、权限分级（作者/管理员）
- **活动日志**：工作区内所有操作的完整历史记录
- **成员在线状态**：实时显示谁在查看同一文档
- **Webhook 集成**：订阅文档/PRD 事件，向外部系统推送 HMAC-SHA256 签名通知

### 企业级功能

- **多工作区**：隔离不同项目的文档和 PRD
- **用户管理**：JWT 认证、密码重置、头像上传
- **AI 模型配置**：用户自行配置各 AI 提供商的 API Key
- **图像生成**：AI 文生图，辅助产品原型设计
- **数据安全**：本地部署，文档不离开私有环境
- **国际化**：中英文双语界面，按浏览器语言自动切换

---

## 快速开始

### 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 推荐 20 LTS |
| pnpm | >= 8 | 包管理器 |
| PostgreSQL | >= 14 | 需安装 pgvector 扩展 |

### 一键 Docker 启动（推荐）

```bash
# 克隆项目
git clone <repo-url> && cd ArchMind

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少配置一个 AI 提供商的 API Key

# 启动所有服务（应用 + PostgreSQL）
docker compose up -d

# 访问应用
open http://localhost:3000
```

### 本地开发安装

```bash
# 1. 克隆并安装依赖
git clone <repo-url> && cd ArchMind
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填写数据库配置和 AI API Key

# 3. 准备 PostgreSQL（含 pgvector 扩展）
psql -c "CREATE DATABASE archmind;"
psql archmind -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql archmind -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# 4. 初始化数据库
pnpm db:init
pnpm tsx scripts/add-fulltext-search.ts
pnpm tsx scripts/add-version-control.ts
pnpm tsx scripts/create-tags-and-categories-tables.ts
pnpm tsx scripts/migrate-to-multi-model-vectors.ts
pnpm tsx scripts/migrate-add-prd-chunks.ts

# 5. 启动开发服务器
pnpm dev

# 访问 http://localhost:3000
```

### 最小配置示例

只需配置数据库和至少一个 AI 提供商即可运行：

```bash
# .env 最小配置
DATABASE_URL=postgresql://user:pass@localhost:5432/archmind
JWT_SECRET=your-secret-key-at-least-32-chars
ENCRYPTION_KEY=your-32-char-encryption-key1234

# 选择至少一个 AI 提供商（推荐 GLM，性价比高）
GLM_API_KEY=your-glm-api-key

# 存储（华为云 OBS）
STORAGE_PROVIDER=huawei-obs
```

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (Nuxt 3 + Vue 3.5)                 │
│  Pages(15) · Components(181+) · Pinia Stores · i18n     │
│         shadcn/ui + Tailwind CSS + vue-bits             │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP / SSE / WebSocket
┌─────────────────────────▼───────────────────────────────┐
│              API Layer (Nuxt Nitro)                       │
│  111 REST endpoints · WebSocket (_ws) · JWT Middleware  │
│  Rate Limiting · CSRF Protection · Zod Validation       │
└──────┬───────��──────────┬────────────────┬──────────────┘
       │                  │                │
┌──────▼──────┐  ┌────────▼──────┐  ┌─────▼────────────────┐
│  AI Service  │  │  RAG Engine   │  │  Business Logic       │
│              │  │               │  │                        │
│  8 Adapters  │  │  Pipeline     │  │  PRD Generator        │
│  (Claude/GPT │  │  TextSplitter │  │  Chat Engine          │
│   Gemini/GLM │  │  Embedding    │  │  Proto Generator      │
│   Qwen/Wxin  │  │  Retriever    │  │  LogicMap Gen         │
│   DeepSeek   │  │  RRF Fusion   │  │  Comment System       │
│   Ollama)    │  │               │  │  Webhook Trigger      │
└──────┬───────┘  └───────┬───────┘  └──────────┬──────────┘
       │                  │                      │
┌──────▼──────────────────▼──────────────────────▼────────┐
│                    Data Layer                             │
│  PostgreSQL 14+ (pgvector) · Drizzle ORM · 17 DAOs      │
│  Redis Cache · Huawei OBS · 25+ Tables                  │
└─────────────────────────────────────────────────────────┘
```

### 核心技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Nuxt 3 | ^3.21.0 |
| 语言 | TypeScript | ^5.9.3 |
| UI 组件 | shadcn/ui (Vue) | radix-vue ^1.9.17 |
| 样式 | Tailwind CSS | ^3.4.19 |
| 数据库 | PostgreSQL + pgvector | 14+ |
| ORM | Drizzle ORM | ^0.29.5 |
| 状态管理 | Pinia | ^2.3.1 |
| 表单验证 | VeeValidate + Zod | ^4.15.0 |
| AI 框架 | LangChain.js | ^0.1.37 |
| 测试 | Vitest | ^4.0.18 |

---

## AI 模型支持

支持 8 大 AI 提供商，根据任务自动选择最优模型：

| 提供商 | 模型 | 适用场景 | 特点 |
|--------|------|----------|------|
| Anthropic | Claude 3.5 Sonnet | PRD 生成 | 最优写作质量 |
| OpenAI | GPT-4o | 通用任务 | 多模态能力 |
| Google | Gemini 1.5 Pro | 超长文档 | 1M Token 上下文 |
| 智谱 AI | GLM-4.7 | 中文内容 | 中文优化，性价比高 |
| 阿里云 | 通义千问 (Qwen) | 中文内容 | 中文优化 |
| 百度 | 文心一言 (Wenxin) | 中文内容 | 国产模型 |
| DeepSeek | DeepSeek Chat | 代码任务 | 代码理解强 |
| Ollama | 本地模型 | 隐私模式 | 完全离线 |

**智能路由策略**（`config/ai-models.yaml`）：

```yaml
preferences:
  prd_generation:  [claude-3.5-sonnet, gpt-4o, glm-4.7]
  chinese_content: [glm-4.7, qwen-max, wenxin-4.0]
  code_tasks:      [gpt-4o, deepseek-chat]
  large_context:   [gemini-1.5-pro]
  cost_sensitive:  [glm-4.5-air, qwen-plus]
  privacy_mode:    [ollama-llama3]
```

用户也可以在 **设置 → Profile → Models Tab** 配置自己的 API Key，并自选每个提供商的可用模型。系统支持 API 中转站（自定义 Base URL），用户配置的密钥会优先于系统环境变量使用。

---

## 配置说明

### 完整环境变量

```bash
# ==================== 数据库 ====================
DATABASE_URL=postgresql://user:pass@localhost:5432/archmind
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ==================== 对象存储 ====================
STORAGE_PROVIDER=huawei-obs

# 华为云 OBS
HUAWEI_OBS_REGION=cn-north-4
HUAWEI_OBS_ACCESS_KEY=your-access-key
HUAWEI_OBS_SECRET_KEY=your-secret-key
HUAWEI_OBS_BUCKET_NAME=archmind

# ==================== AI 模型 ====================
ANTHROPIC_API_KEY=sk-ant-...    # Claude
OPENAI_API_KEY=sk-...           # GPT-4o
GOOGLE_API_KEY=...              # Gemini
GLM_API_KEY=...                 # 智谱 GLM
DASHSCOPE_API_KEY=...           # 通义千问
BAIDU_API_KEY=...               # 文心一言（API Key）
BAIDU_SECRET_KEY=...            # 文心一言（Secret Key）
DEEPSEEK_API_KEY=...            # DeepSeek
OLLAMA_BASE_URL=http://localhost:11434  # Ollama

# ==================== RAG 配置 ====================
EMBEDDING_MODEL=text-embedding-3-small
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K=5
SIMILARITY_THRESHOLD=0.7

# ==================== AI 默认 ====================
DEFAULT_MODEL=glm-4.7
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=8000

# ==================== 邮件（密码重置）====================
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your@qq.com
EMAIL_PASS=your-auth-code

# ==================== 安全 ====================
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-32-char-encryption-key

# ==================== 应用 ====================
APP_URL=http://localhost:3000
NODE_ENV=development
```

### AI 模型配置文件

编辑 `config/ai-models.yaml` 调整模型路由策略：

```yaml
ai_models:
  default: glm-4.7
  fallback: [glm-4.5-air, gpt-4o, claude-3.5-sonnet]
  preferences:
    prd_generation: [claude-3.5-sonnet, gpt-4o, glm-4.7]
    chinese_content: [glm-4.7, qwen-max, wenxin-4.0]
    code_tasks: [gpt-4o, deepseek-chat]
    large_context: [gemini-1.5-pro]

embedding:
  provider: openai
  model: text-embedding-3-small
  dimensions: 1536
```

---

## 开发指南

### 常用命令

```bash
# 开发
pnpm dev              # 启动开发服务器（http://localhost:3000）
pnpm build            # 构建生产版本
pnpm preview          # 预览生产构建

# 代码质量
pnpm lint             # ESLint 检查
pnpm lint:fix         # 自动修复 ESLint 错误
pnpm format           # Prettier 格式化
pnpm typecheck        # TypeScript 类型检查

# 测试
pnpm test             # 运行所有测试
pnpm test:watch       # 监听模式
pnpm test:coverage    # 生成覆盖率报告
pnpm test:ui          # Vitest UI 界面

# 数据库
pnpm db:init          # 初始化数据库表结构
pnpm db:seed          # 添加测试种子数据
pnpm db:migrate       # 运行 Schema 迁移

# 存储健康检查
pnpm storage:health   # 检查存储连接状态
```

### 项目结构

```
ArchMind/
├── pages/              # 页面（15 个路由）
│   ├── index.vue       # 首页
│   ├── generate.vue    # PRD 生成界面
│   ├── knowledge-base.vue  # 知识库管理
│   ├── prototypes.vue  # 原型列表
│   ├── projects/[id].vue   # PRD 项目详情
│   └── settings/       # 用户设置
│
├── server/api/         # API 路由（111 个端点）
│   ├── auth/           # 认证接口
│   ├── documents/      # 文档管理
│   ├── prd/            # PRD 生成
│   ├── chat/           # 流式对话
│   ├── prototypes/     # 原型管理
│   └── ai/             # AI 配置
│
├── components/         # Vue 组件（181+）
│   ├── ui/             # shadcn/ui 基础组件（30+）
│   ├── chat/           # 对话组件
│   ├── prototype/      # 原型组件
│   ├── documents/      # 文档组件
│   └── logic-map/      # 逻辑图组件
│
├── lib/                # 核心业务逻辑
│   ├── ai/             # AI 服务层（10 个适配器）
│   ├── rag/            # RAG 引擎
│   ├── prd/            # PRD 生成引擎
│   ├── prototype/      # 原型生成
│   ├── logic-map/      # 逻辑图生成
│   ├── db/             # 数据库层（17 个 DAO）
│   └── storage/        # 对象存储抽象
│
├── composables/        # Vue 组合式函数（9 个）
├── stores/             # Pinia 状态管理（3 个）
├── types/              # TypeScript 类型定义（13 个）
├── config/             # 配置文件
│   └── ai-models.yaml  # AI 模型配置
├── migrations/         # 数据库迁移 SQL
├── scripts/            # 工具脚本（19 个）
├── tests/              # 测试文件（18 个，292+ 个测试用例，~89% 覆盖率）
└── docs/               # 项目文档（31 个）
    └── WIKI.md         # 项目百科全书（完整参考手册）
```

### 开发规范

**UI 组件**：只使用 `~/components/ui/` 下的 shadcn/ui 组件，不引入其他 UI 库。

**样式**：只使用 Tailwind CSS 原子类，条件类使用 `cn()` 函数。

**API 路由**：遵循"验证 → 鉴权 → 业务 → 返回"四步模式，使用 Zod 进行输入验证。

**提交规范**：遵循 [Conventional Commits](https://www.conventionalcommits.org/)（`feat/fix/docs/refactor/test/chore`）。

---

## 部署指南

### Docker Compose 部署（推荐）

```bash
# 开发/测试环境（本地构建，暴露所有端口）
docker compose up -d

# 生产环境部署（预构建镜像 + Nginx 反向代理 + 端口隔离 + 资源限制）
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 查看运行状态
docker compose ps

# 查看应用日志
docker compose logs -f archmind
```

**生产环境与开发环境的差异（`docker-compose.prod.yml`）：**

| 配置项 | 开发环境 | 生产环境 |
|--------|---------|---------|
| 应用来源 | 本地 build | 预构建镜像 (`ARCHMIND_IMAGE`) |
| 端口暴露 | 3000/5432/6379 | 仅 80/443（通过 nginx） |
| nginx | 可选 profile | 强制启用 |
| Redis 持久化 | 无 | AOF 持久化 |
| 资源限制 | 无 | app: 2C/2G，db: 2C/4G |

### 手动部署

```bash
# 1. 构建
pnpm build

# 2. 启动（使用 PM2 进程管理）
npm install -g pm2
pm2 start .output/server/index.mjs --name archmind

# 3. 开机自启
pm2 save && pm2 startup
```

### 生产环境建议

| 配置项 | 建议值 | 说明 |
|--------|--------|------|
| `DATABASE_POOL_MAX` | 20 | 高并发下提高连接池上限 |
| `STORAGE_PROVIDER` | `huawei-obs` | 使用华为云 OBS 对象存储 |
| `NODE_ENV` | `production` | 启用生产模式优化 |
| JWT 有效期 | 根据安全需求 | 当前默认 7 天 |

### 健康检查

```bash
# API 健康检查
curl http://localhost:3000/api/health

# 存储连接检查
pnpm storage:health
```

---

## 文档导航

| 文档 | 描述 |
|------|------|
| **[docs/WIKI.md](./docs/WIKI.md)** | **项目百科全书（完整参考手册）** |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更历史与路线图 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献指南 |
| [docs/技术路线与架构文档.md](./docs/技术路线与架构文档.md) | 系统架构详细设计 |
| [docs/详细设计/](./docs/详细设计/) | 各模块详细设计文档 |
| [docs/SHADCN_USAGE.md](./docs/SHADCN_USAGE.md) | shadcn/ui 组件使用指南 |
| [docs/GLM_INTEGRATION.md](./docs/GLM_INTEGRATION.md) | 智谱 AI GLM 集成指南 |
| [docs/WORKSPACE_GUIDE.md](./docs/WORKSPACE_GUIDE.md) | 多工作区使用指南 |
| [docs/LOGIC_COVERAGE.md](./docs/LOGIC_COVERAGE.md) | 逻辑覆盖率功能说明 |
| [docs/I18N.md](./docs/I18N.md) | 国际化配置指南 |
| [docs/huawei-obs-deployment.md](./docs/huawei-obs-deployment.md) | 华为云 OBS 部署指南 |

---

## 路线图

### v0.3.0（已发布 ✅）

实时协作与系统集成：

- ✅ **WebSocket 实时通信**：Nitro 原生 WebSocket，HttpOnly Cookie 服务端鉴权，工作区房间管理，心跳保活
- ✅ **团队协作**：评论系统（@提及/解决/权限分级）、活动日志、成员在线状态实时展示
- ✅ **Webhook 支持**：订阅文档/PRD 事件，HMAC-SHA256 签名，自定义 Header，投递日志记录
- ✅ **OpenAPI 文档**：`@scalar/nuxt` 集成，交互式 API 文档（`/api-docs`），自动生成 `openapi.json`
- ✅ **Docker 生产配置**：`docker-compose.prod.yml` 资源限制、Nginx WebSocket 代理、AOF 持久化、备份脚本
- ✅ **国际化完善**：中英文切换，组件级 i18n
- ✅ **安全修复（Review）**：WebSocket Cookie 鉴权修复、迁移文件 UUID 类型修复、评论权限加固、Webhook Header 顺序修复、Docker 弱密码移除、注册事务原子性

### v0.2.1（已发布 ✅）

安全加固与稳定性修复：
- ✅ **工作区权限隔离**：6 个 API 端点校验成员身份和角色权限
- ✅ **JWT / API Key 弱密钥修复**：生产环境未配置时启动报错
- ✅ **PRD 内容 XSS 防护**：DOMPurify 净化 marked() 输出
- ✅ **AI 适配器稳定性**：空 choices 防崩溃、ModelManager 竞态修复
- ✅ **PRD 知识库索引修复**：prd_chunks 表 + document_embeddings FK 约束
- ✅ **localStorage 健壮性**：数据损坏自动恢复、写入配额溢出处理

### v0.2.0（已发布 ✅）

已完成：
- ✅ **Rate Limiting 中间件**：IP + 路径级别请求限流，无 Redis 依赖
- ✅ **CSRF 保护中间件**：Origin/Referer 来源校验，防跨站请求伪造
- ✅ **混合搜索 RRF 正式启用**：`retrieve()` 默认走 RRF 混合搜索，PRD 生成 & 对话检索质量提升
- ✅ **结构化日志系统**：pino-based JSON 日志，支持请求追踪
- ✅ **测试覆盖率**：从 15% 提升至 89%
- ✅ **Sentry 错误监控**：前后端全链路错误追踪

### v0.1.1（已发布）
用户级 AI 配置数据隔离、全局 JWT 认证中间件、自定义 API Base URL 支持、动态模型列表获取、模型配置 UI 整合至 Profile 页面

### v0.1.0（已发布）
文档管理、RAG 搜索、PRD 生成、原型系统、逻辑图、图像生成、多工作区、用户系统

### v1.0.0（计划中）
- RBAC 权限系统
- 批量数据导出/导入
- Kubernetes 部署配置
- 插件系统

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

```bash
# 1. Fork 并克隆
git clone https://github.com/your-fork/archmind.git

# 2. 创建特性分支
git checkout -b feat/your-feature

# 3. 开发并测试
pnpm test

# 4. 提交（遵循 Conventional Commits）
git commit -m "feat: add your feature"

# 5. 推送并创建 Pull Request
git push origin feat/your-feature
```

### PR 检查清单

- [ ] 代码通过 `pnpm lint` 检查
- [ ] 代码通过 `pnpm typecheck` 检查
- [ ] 相关测试通过 `pnpm test`
- [ ] 新功能有对应的测试用例
- [ ] 必要时更新文档

---

## 性能指标

| 指标 | 测量值 |
|------|--------|
| 批量上传（10 文件 × 5MB） | ~8 秒 |
| 混合搜索（1000 文档库） | < 2 秒 |
| 混合 vs 单一搜索准确率 | +20% |
| PRD 流式生成首 Token | < 2 秒 |

---

## 安全说明

- **JWT 认证**：全局中间件统一拦截，所有 API 接口强制认证，令牌 7 天有效；生产环境未设置 `JWT_SECRET` 时启动即报错
- **WebSocket 鉴权**：WS 连接建立时服务端从 HTTP 升级请求的 HttpOnly Cookie 中读取 JWT 完成鉴权，客户端无法篡改
- **密码安全**：bcrypt 哈希（cost 12），密码不可逆
- **API Key 加密**：用户配置的 AI API Key 使用 AES-256 加密存储，按用户隔离；生产环境未设置 `API_KEY_ENCRYPTION_SECRET` 时启动即报错
- **工作区权限隔离**：所有工作区 API 端点校验用户成员身份与角色（member/admin/owner），拒绝越权访问；评论修改/解决操作同样执行工作区成员校验
- **Webhook 签名**：所有投递请求附带 HMAC-SHA256 签名，用户自定义 Header 不可覆盖系统安全 Header
- **XSS 防护**：PRD 内容渲染前通过 DOMPurify 净化，仅允许安全的 HTML 标签与属性
- **Rate Limiting**：IP + 路径级别请求限流（认证接口 10 次/分钟，AI 生成 20 次/分钟，邀请接口 5 次/分钟，其他 120 次/分钟）
- **CSRF 保护**：Origin/Referer 来源校验，防跨站请求伪造
- **用户数据隔离**：AI 配置、向量统计等数据均按用户独立存储，不同用户的数据完全隔离
- **文件访问**：使用预签名 URL，限时有效（默认 1 小时）
- **生产环境强制配置**：`DB_PASSWORD`、`JWT_SECRET`、`API_KEY_ENCRYPTION_SECRET` 均无默认值，未设置时 Docker Compose ��动即报错
- **本地优先**：所有文档存储在私有数据库，不上传至第三方
- **隐私模式**：使用 Ollama 本地模型可实现 AI 调用完全离线

---

## 技术支持

- 查阅 [项目百科全书](./docs/WIKI.md) 了解所有技术细节
- 提交 [GitHub Issue](https://github.com/your-org/archmind/issues) 报告问题
- 参考 [CLAUDE.md](./CLAUDE.md) 了解 AI 辅助开发规范

---

## License

[GPL-3.0](LICENSE)

---

## 贡献者

感谢所有为本项目做出贡献的人！

<a href="https://github.com/ssyamv/ArchMind/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ssyamv/ArchMind" alt="Contributors" />
</a>

---

<p align="center">
  Built with Nuxt 3 · PostgreSQL · pgvector · shadcn/ui
</p>
