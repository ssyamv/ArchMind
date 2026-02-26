# ArchMind AI 项目百科全书

> 本文档是 ArchMind AI 项目的完整参考手册，涵盖产品、架构、设计、开发、部署的所有方面。

---

## 目录

- [1. 产品概述](#1-产品概述)
- [2. 功能详细说明](#2-功能详细说明)
- [3. 系统架构](#3-系统架构)
- [4. 技术栈全景](#4-技术栈全景)
- [5. 数据库设计](#5-数据库设计)
- [6. AI 服务层设计](#6-ai-服务层设计)
- [7. RAG 引擎设计](#7-rag-引擎设计)
- [8. PRD 生成引擎](#8-prd-生成引擎)
- [9. API 层设计](#9-api-层设计)
- [10. 前端架构设计](#10-前端架构设计)
- [11. 存储系统设计](#11-存储系统设计)
- [12. 认证与安全](#12-认证与安全)
- [13. 国际化设计](#13-国际化设计)
- [14. 部署与运维](#14-部署与运维)
- [15. 开发规范](#15-开发规范)
- [16. 测试策略](#16-测试策略)
- [17. 性能优化](#17-性能优化)
- [18. 项目路线图](#18-项目路线图)
- [19. 已知问题与限制](#19-已知问题与限制)
- [20. 术语表](#20-术语表)

---

## 1. 产品概述

### 1.1 产品定位

**ArchMind AI** 是一个本地优先的智能产品工具，通过 RAG（检索增强生成）技术将企业历史文档转化为结构化的产品需求文档（PRD）和可交互原型。

**核心价值主张**：让每一份历史文档都成为新功能的基础，消除产品迭代中的逻辑断层。

### 1.2 目标用户

| 用户角色 | 使用场景 | 核心需求 |
|----------|----------|----------|
| 产品经理 | 快速生成 PRD，参考历史功能设计 | 高质量 PRD、减少重复工作 |
| 技术负责人 | 知识库管理，技术文档检索 | 快速找到相关技术决策 |
| 设计师 | 参考历史设计规范 | 设计一致性 |
| 研发团队 | 了解历史业务逻辑 | 减少沟通成本 |

### 1.3 核心功能矩阵

| 功能模块 | 子功能 | 状态 |
|----------|--------|------|
| **文档管理** | 上传 PDF/DOCX/Markdown | ✅ 已实现 |
| | 版本控制 | ✅ 已实现 |
| | 智能去重 (SHA-256) | ✅ 已实现 |
| | 批量上传 (并行处理) | ✅ 已实现 |
| | 标签 & 分类管理 | ✅ 已实现 |
| | 文档分享 (预签名 URL) | ✅ 已实现 |
| **智能搜索** | 关键词全文检索 | ✅ 已实现 |
| | 向量语义搜索 | ✅ 已实现 |
| | 混合搜索 (RRF 融合) | ✅ 已实现 |
| **PRD 生成** | 对话式 PRD 生成 | ✅ 已实现 |
| | 流式输出 | ✅ 已实现 |
| | 多轮迭代优化 | ✅ 已实现 |
| | RAG 上下文注入 | ✅ 已实现 |
| | 引用文档追踪 | ✅ 已实现 |
| **原型系统** | HTML 原型生成 | ✅ 已实现 |
| | 多页原型管理 | ✅ 已实现 |
| | 设备类型预览 | ✅ 已实现 |
| | 代码编辑器 | ✅ 已实现 |
| **逻辑图** | 自动生成逻辑图 | ✅ 已实现 |
| | 覆盖率分析 | ✅ 已实现 |
| **图像生成** | AI 图像生成 | ✅ 已实现 |
| | 图像编辑 | ✅ 已实现 |
| **用户系统** | JWT 注册/登录 | ✅ 已实现 |
| | 密码重置 | ✅ 已实现 |
| | 头像上传 | ✅ 已实现 |
| **工作区** | 多工作区隔离 | ✅ 已实现 |
| | 工作区成员管理 | ✅ 已实现 |
| **AI 配置** | 用户自定义 API Key | ✅ 已实现 |
| | 多提供商配置 | ✅ 已实现 |
| | 用户自选模型列表 | ✅ 已实现 |
| | 自定义 API Base URL（中转站）| ✅ 已实现 |
| | 动态获取提供商模型列表 | ✅ 已实现 |

### 1.4 产品指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 批量上传速度 | 10 文件 (5MB) / 8 秒 | < 5 秒 |
| 混合搜索响应时间 | < 2 秒 (1000 文档) | < 1 秒 |
| 搜索准确率提升 | +20% (vs 单一模式) | +30% |
| 测试覆盖率 | ~89% | 95% |
| API 端点数 | 111 个 | - |
| Vue 组件数 | 181+ | - |

---

## 2. 功能详细说明

### 2.1 文档管理系统

#### 2.1.1 文档上传流程

```
用户上传文件
    │
    ▼
格式校验 (PDF/DOCX/MD)
    │
    ▼
SHA-256 哈希去重检测
    │ 重复 → 提示用户
    ▼ 不重复
存储到对象存储 (华为云 OBS)
    │
    ▼
文档元数据入库
    │
    ▼
触发异步处理 (状态: processing)
    │
    ├─→ 文本提取 (PDF→pdf-parse, DOCX→mammoth)
    │
    ├─→ 文本分块 (chunk_size=1000, overlap=200)
    │
    ├─→ 向量化 (embedding model)
    │
    ├─→ 向量存入 pgvector
    │
    └─→ 全文检索索引 (tsvector)
    │
    ▼
状态更新 (completed)
```

#### 2.1.2 支持的文件格式

| 格式 | 处理库 | 说明 |
|------|--------|------|
| PDF | pdf-parse | 提取纯文本，保留段落结构 |
| DOCX | mammoth | 转换 Word 文档，保留样式 |
| Markdown | 原生解析 | 直接读取，保留 Markdown 语法 |

#### 2.1.3 版本控制

每次文档更新会创建新版本快照：

```typescript
interface DocumentVersion {
  id: string
  documentId: string
  versionNumber: number
  filePath: string        // 存储此版本的文件路径
  fileSize: number
  description: string     // 版本说明
  createdAt: Date
}
```

#### 2.1.4 文档状态机

```
uploaded → processing → completed
                ↓
             error (可重试)
```

### 2.2 混合搜索引擎

混合搜索结合关键词搜索和向量搜索，使用 RRF（Reciprocal Rank Fusion）算法融合结果。

#### 搜索模式对比

| 模式 | 技术实现 | 优点 | 缺点 |
|------|----------|------|------|
| 关键词搜索 | PostgreSQL tsvector + GIN 索引 | 精确匹配，速度快 | 无法理解语义 |
| 向量搜索 | pgvector + IVFFlat 索引 | 语义理解，模糊匹配 | 需要 embedding 计算 |
| 混合搜索 | RRF 融合两种结果 | 综合两者优势 | 计算量稍大 |

#### RRF 融合公式

```
score(d) = Σ 1/(k + rank_i(d))

其中:
- k = 60 (常量)
- rank_i(d) = 文档 d 在第 i 种检索中的排名
```

### 2.3 PRD 生成系统

#### 2.3.1 对话式生成流程

1. 用户在对话框输入需求描述
2. 系统自动进行 RAG 检索，找到相关历史文档
3. 构建上下文 Prompt（包含历史文档内容）
4. 调用 AI 模型（支持流式输出）
5. PRD 实时展示在右侧预览面板
6. 用户可继续追加对话进行迭代优化
7. 最终保存到数据库

#### 2.3.2 PRD 文档结构

标准 PRD 包含以下章节：

1. **功能概述** - 功能简介和价值说明
2. **业务背景与目标** - 为什么要做，要达到什么目标
3. **用户故事** - 用户视角的需求描述
4. **功能详细说明** - 具体功能点的详细描述
5. **业务流程图** - Mermaid 格式流程图
6. **界面设计要求** - UI/UX 要求
7. **数据模型** - 涉及的数据结构
8. **异常处理** - 边界情况和错误处理
9. **非功能需求** - 性能、安全、可用性
10. **变更影响分析** - 对现有功能的影响

### 2.4 原型生成系统

#### 2.4.1 原型生成流程

```
PRD 文档
    │
    ▼
AI 解析 PRD 结构和页面需求
    │
    ▼
生成多页 HTML 原型
    │
    ├─→ 页面 1: HTML + CSS + JS (完整单页应用)
    ├─→ 页面 2: ...
    └─→ 页面 N: ...
    │
    ▼
存储到 prototype_pages 表
    │
    ▼
在 iframe 中预览（DOMPurify 安全处理）
```

#### 2.4.2 设备类型支持

| 类型 | 视口宽度 | 适用场景 |
|------|----------|----------|
| responsive | 100% | 响应式设计 |
| mobile | 375px | 移动端原型 |
| desktop | 1280px | 桌面端原型 |

### 2.5 逻辑图系统

从 PRD 内容自动生成可视化逻辑图，展示功能点之间的关系和流程。支持：

- 节点类型：需求节点、功能节点、技术节点、边界节点
- 边类型：依赖关系、触发关系、数据流
- 覆盖率计算：分析 PRD 覆盖的需求比例

---

## 3. 系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser / Client                              │
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │  Pages   │  │Components│  │Composables│  │    Pinia Stores      │ │
│  │  (15)    │  │  (180+)  │  │    (8)   │  │  auth/workspace/prd  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘ │
│                                                                       │
│           Nuxt 3 + Vue 3.5 + TypeScript 5.9 (SPA + SSR)             │
│                shadcn/ui + Tailwind CSS + vue-bits                   │
└──────────────────────────────┬──────────────────────────────────────┘
                                │ HTTP/SSE
┌──────────────────────────────▼──────────────────────────────────────┐
│                    Nuxt 3 Server (Nitro)                              │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     API Routes (95 endpoints)                   │  │
│  │  /auth  /documents  /prd  /chat  /prototypes  /workspaces      │  │
│  │  /tags  /categories  /ai  /assets  /logic-maps  /stats         │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Server Middleware: JWT Auth Validation                               │
│  Server Utils: jwt.ts, password.ts, email.ts, errors.ts             │
└──────────────────────────────┬──────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐  ┌──────────▼────────┐  ┌──────────▼────────┐
│   AI Service   │  │   RAG Engine       │  │   Business Logic   │
│   Layer        │  │                    │  │                    │
│                │  │  ┌──────────────┐  │  │  ┌─────────────┐  │
│  ┌──────────┐  │  │  │ DocumentProc │  │  │  │ PRDGenerator│  │
│  │ Manager  │  │  │  │  (pipeline)  │  │  │  └─────────────┘  │
│  └──────────┘  │  │  └──────────────┘  │  │                    │
│       │        │  │  ┌──────────────┐  │  │  ┌─────────────┐  │
│  8 Adapters    │  │  │ TextSplitter │  │  │  │ ChatEngine  │  │
│  Claude/GPT    │  │  └──────────────┘  │  │  └─────────────┘  │
│  Gemini/GLM    │  │  ┌──────────────┐  │  │                    │
│  Qwen/Wenxin   │  │  │ EmbeddingSvc │  │  │  ┌─────────────┐  │
│  DeepSeek      │  │  └──────────────┘  │  │  │ ProtoGentr  │  │
│  Ollama        │  │  ┌──────────────┐  │  │  └─────────────┘  │
└───────┬────────┘  │  │  Retriever   │  │  │                    │
        │           │  └──────────────┘  │  │  ┌─────────────┐  │
        │           └──────────┬─────────┘  │  │ LogicMapGen │  │
        │                      │            │  └─────────────┘  │
        │                      │            └────────────────────┘
        └──────────────────────┼─────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Data Persistence Layer                            │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  PostgreSQL 14+ Database                      │    │
│  │                                                               │    │
│  │  Core Tables:                    Vector & Search:             │    │
│  │  users, workspaces               document_chunks (pgvector)   │    │
│  │  documents, document_versions    GIN indexes (tsvector)        │    │
│  │  prd_documents, conversations    IVFFlat index                 │    │
│  │  prototypes, prototype_pages                                   │    │
│  │  assets, prd_assets              Drizzle ORM + DAO Layer       │    │
│  │  tags, categories                (15 DAOs)                     │    │
│  │  logic_maps, user_api_configs                                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────┐  ┌─────────────────────────────────────┐  │
│  │   Object Storage      │  │          External APIs              │  │
│  │  Huawei OBS            │  │  Anthropic / OpenAI / Google         │  │
│  │  Huawei OBS (prod)    │  │  Zhipu / Qwen / Baidu / DeepSeek   │  │
│  │  Storage Abstraction  │  │  Ollama (local), SMTP (email)       │  │
│  └──────────────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 请求处理流程

```
Client Request
    │
    ▼
Nuxt Server (Nitro)
    │
    ▼
JWT Middleware (server/middleware/)
    │  Token 验证
    │  提取 userId → event.context.userId
    ▼
API Route Handler (server/api/*)
    │  1. 输入验证 (Zod schema)
    │  2. 权限检查 (userId)
    │  3. 调用 DAO / Service
    ▼
Business Logic (lib/)
    │  PRD Generator / RAG / Chat Engine
    ▼
Data Layer (lib/db/dao/)
    │  Drizzle ORM + PostgreSQL
    ▼
Response
```

### 3.3 模块依赖关系

```
pages/ ──→ composables/ ──→ API Routes ──→ lib/
  │                                          │
  └──→ components/ ──→ stores/          ┌───┴──────────────┐
                                        │  AI / RAG / PRD  │
                                        │  DB DAO Layer     │
                                        └──────────────────┘
```

---

## 4. 技术栈全景

### 4.1 前端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Nuxt 3 | ^3.21.0 | SSR/SPA 框架，文件路由 |
| 语言 | TypeScript | ^5.9.3 | 类型安全 |
| UI 框架 | Vue 3 | ^3.5.27 | Composition API |
| UI 组件 | shadcn/ui (Vue) | radix-vue ^1.9.17 | 30+ 高质量组件 |
| 样式 | Tailwind CSS | ^3.4.19 | 原子化 CSS |
| 动效 | vue-bits / GSAP | ^3.14.2 | 视觉动效 |
| 状态管理 | Pinia | ^2.3.1 | 响应式状态 |
| 表单验证 | VeeValidate + Zod | ^4.15.0 / ^3.25.0 | 表单管理 |
| 图标 | lucide-vue-next | ^0.563.0 | 图标库 |
| 流程图 | @vue-flow/core | ^1.48.2 | 逻辑图可视化 |
| 富文本编辑 | @tiptap/vue-3 | ^3.19.0 | PRD 编辑器 |
| 代码编辑 | @guolao/vue-monaco-editor | ^1.6.0 | 原型代码编辑 |
| 图片裁剪 | vue-advanced-cropper | ^2.8.9 | 头像上传 |
| 工具函数 | @vueuse/core | ^10.11.1 | Vue 组合式工具 |
| 国际化 | @nuxtjs/i18n | ^10.2.1 | 中英文切换 |
| 主题 | @nuxtjs/color-mode | ^3.5.2 | 深色/浅色模式 |

### 4.2 服务端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 运行时 | Node.js | >= 18 | JavaScript 运行时 |
| 服务器 | Nitro (Nuxt) | - | HTTP 服务器，API 路由 |
| ORM | Drizzle ORM | ^0.29.5 | 类型安全数据库操作 |
| 数据库 | PostgreSQL | 14+ | 主数据库 |
| 向量搜索 | pgvector | ^0.1.8 | 向量存储与检索 |
| 数据库驱动 | pg | ^8.18.0 | PostgreSQL 客户端 |
| AI 框架 | LangChain.js | ^0.1.37 | AI 编排 |
| Anthropic | @anthropic-ai/sdk | ^0.20.9 | Claude 集成 |
| OpenAI | openai | ^4.104.0 | GPT 集成 |
| Google AI | @google/generative-ai | ^0.2.1 | Gemini 集成 |
| PDF 解析 | pdf-parse | ^1.1.4 | PDF 文本提取 |
| DOCX 解析 | mammoth | ^1.11.0 | Word 文档转换 |
| 认证 | jsonwebtoken | ^9.0.3 | JWT 令牌 |
| 密码加密 | bcrypt | ^6.0.0 | 密码哈希 |
| 邮件 | nodemailer | ^8.0.1 | SMTP 邮件发送 |
| 对象存储 | @aws-sdk/client-s3 | ^3.986.0 | 兼容 S3 的存储 |
| 文件归档 | archiver | ^7.0.1 | 文件压缩导出 |
| YAML 解析 | js-yaml | ^4.1.1 | 配置文件解析 |
| HTML 净化 | dompurify | ^3.3.1 | 原型安全渲染 |

### 4.3 开发工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| pnpm | >= 8 | 包管理器 |
| Vitest | ^4.0.18 | 单元测试框架 |
| ESLint | ^9.39.2 | 代码质量检查 |
| Prettier | ^3.8.1 | 代码格式化 |
| tsx | ^4.21.0 | TypeScript 脚本执行 |
| drizzle-kit | ^0.20.18 | 数据库迁移工具 |

---

## 5. 数据库设计

### 5.1 数据库总览

```
PostgreSQL 14+ (with pgvector, uuid-ossp, pg_trgm extensions)

核心表 (20+ tables):
┌─────────────────┐    ┌────────────────────┐
│    workspaces   │◄───┤      users         │
└────────┬────────┘    └────────────────────┘
         │                      │
    workspace_id           user_id
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌────────────────────┐
│    documents    │    │   prd_documents    │
│                 │    │                    │
│  + versions     │    │  + conversations   │
│  + chunks(vec)  │    │  + prototypes      │
│  + tags/cats    │    │  + assets          │
│  + access_tok   │    │  + logic_maps      │
└─────────────────┘    └────────────────────┘
         │                      │
         └──────────┬───────────┘
                    │
         prd_document_references
```

### 5.2 完整表结构

#### users 表

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username          VARCHAR(50) NOT NULL UNIQUE,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  full_name         VARCHAR(100),
  avatar_url        TEXT,
  is_active         BOOLEAN DEFAULT true,
  reset_token       VARCHAR(255),              -- 密码重置 Token
  reset_token_expires TIMESTAMP WITH TIME ZONE, -- Token 过期时间
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_reset_token ON users(reset_token);
```

#### workspaces 表

```sql
CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon        VARCHAR(10) DEFAULT '📁',
  color       VARCHAR(20) DEFAULT '#3B82F6',
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workspaces_is_default ON workspaces(is_default);
```

#### documents 表

```sql
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  file_path    TEXT NOT NULL,           -- 对象存储路径
  file_type    VARCHAR(20) NOT NULL,    -- pdf/docx/md
  file_size    INTEGER NOT NULL,
  content      TEXT,                    -- 提取的文本内容
  metadata     JSONB DEFAULT '{}',      -- 扩展元数据
  status       VARCHAR(20) DEFAULT 'uploaded',  -- uploaded/processing/completed/error
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 全文检索 (需手动添加 search_vector 字段和 GIN 索引)
ALTER TABLE documents ADD COLUMN search_vector tsvector;
CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);
CREATE INDEX idx_documents_workspace_id ON documents(workspace_id);
CREATE INDEX idx_documents_status ON documents(status);
```

#### document_chunks 表 (向量存储)

```sql
CREATE TABLE document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(1536),            -- pgvector 向量 (OpenAI text-embedding-3-small)
  metadata     JSONB DEFAULT '{}',      -- 包含 embedding_model, dimensions 等
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IVFFlat 向量索引
CREATE INDEX idx_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
```

#### prd_documents 表

```sql
CREATE TABLE prd_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  content         TEXT NOT NULL,        -- Markdown 格式 PRD 内容
  user_input      TEXT NOT NULL,        -- 用户原始输入
  model_used      VARCHAR(100) NOT NULL, -- 使用的 AI 模型
  generation_time INTEGER,              -- 生成耗时 (ms)
  token_count     INTEGER,              -- Token 消耗量
  estimated_cost  DECIMAL(10, 4),       -- 估算成本 (USD)
  status          VARCHAR(20) DEFAULT 'draft',  -- draft/published/archived
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### prototypes 表

```sql
CREATE TABLE prototypes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id          UUID REFERENCES prd_documents(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  current_version INTEGER DEFAULT 1,
  status          VARCHAR(20) DEFAULT 'draft',
  device_type     VARCHAR(20) DEFAULT 'responsive',  -- responsive/mobile/desktop
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### prototype_pages 表

```sql
CREATE TABLE prototype_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id  UUID REFERENCES prototypes(id) ON DELETE CASCADE NOT NULL,
  page_name     VARCHAR(200) NOT NULL,
  page_slug     VARCHAR(100) NOT NULL,
  html_content  TEXT NOT NULL,          -- 完整的 HTML 页面内容
  sort_order    INTEGER DEFAULT 0,
  is_entry_page BOOLEAN DEFAULT false,   -- 入口页面标记
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prototype_id, page_slug)
);
```

#### conversations 和 conversation_messages 表

```sql
CREATE TABLE conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(500) NOT NULL,
  summary        TEXT,
  message_count  INTEGER DEFAULT 0,
  prd_id         UUID REFERENCES prd_documents(id) ON DELETE SET NULL,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE conversation_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role             VARCHAR(20) NOT NULL,  -- user/assistant
  content          TEXT NOT NULL,
  model_used       VARCHAR(100),
  use_rag          BOOLEAN DEFAULT false,
  document_ids     TEXT,                  -- JSON array string
  prd_content      TEXT,                  -- 生成的 PRD 快照
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### user_api_configs 表

```sql
-- 存储用户自定义的 AI 提供商 API Key (AES 加密)，按用户隔离
CREATE TABLE user_api_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 用户隔离
  provider          VARCHAR(50) NOT NULL,                -- openai/anthropic/google/glm 等
  api_key_encrypted TEXT,                               -- AES-256 加密存储
  base_url          VARCHAR(500),                        -- 自定义 base URL (中转站/Ollama等)
  models            JSONB DEFAULT '[]',                  -- 用户自选的模型 ID 列表
  enabled           BOOLEAN DEFAULT true,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)                             -- 每个用户每个提供商唯一
);

-- 索引
CREATE INDEX idx_user_api_configs_user_id ON user_api_configs(user_id);
```

#### assets 表 (图像资产)

```sql
CREATE TABLE assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  file_name         VARCHAR(500) NOT NULL,
  file_type         VARCHAR(50) NOT NULL,
  file_size         INTEGER NOT NULL,
  storage_provider  VARCHAR(50) DEFAULT 'huawei-obs',
  storage_bucket    VARCHAR(200),
  storage_key       VARCHAR(1000) NOT NULL,
  content_hash      VARCHAR(64),
  source            VARCHAR(20) NOT NULL,  -- upload/ai-generated
  generation_prompt TEXT,
  model_used        VARCHAR(100),
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5.3 数据库迁移历史

| 迁移文件 | 内容 |
|----------|------|
| `init-db.ts` | 初始建表（users, documents, prd_documents 等） |
| `add-fulltext-search.ts` | 添加全文检索（tsvector, GIN 索引） |
| `add-version-control.ts` | 添加版本控制（document_versions） |
| `create-tags-and-categories-tables.ts` | 标签和分类系统 |
| `create-processing-logs-table.ts` | 文档处理日志 |
| `create-document-access-tokens-table.ts` | 文档分享令牌 |
| `migrations/add-assets-tables.sql` | 图像资产表 |
| `migrations/add-prototype-device-type.sql` | 原型设备类型 |
| `migrations/add-workspaces-support.sql` | 多工作区支持 |
| `migrations/add_reset_token_fields.sql` | 密码重置令牌 |
| `migrations/add-user-data-isolation.sql` | 用户级 API 配置隔离（user_id 字段） |
| `migrations/add-user-model-selection.sql` | 用户自选模型列表（models 字段） |
| `lib/db/migrate-logic-maps.ts` | 逻辑图表 |

---

## 6. AI 服务层设计

### 6.1 统一适配器接口

所有 AI 模型通过统一接口抽象：

```typescript
interface AIModelAdapter {
  readonly name: string       // 模型显示名称
  readonly provider: string   // 提供商名称
  readonly maxTokens: number  // 最大 Token 数

  // 核心方法
  generateText(prompt: string, options?: GenerateOptions): Promise<string>
  generateStream(prompt: string, options?: GenerateOptions): AsyncIterator<string>
  generateStructured<T>(prompt: string, schema: JSONSchema): Promise<T>

  // 辅助方法
  estimateCost(inputTokens: number, outputTokens: number): number
  isAvailable?(): Promise<boolean>
}

interface GenerateOptions {
  temperature?: number         // 0-2, 默认 0.7
  maxTokens?: number           // 最大输出 Token
  topP?: number
  stopSequences?: string[]
  systemPrompt?: string
}
```

### 6.2 已实现的模型适配器

所有适配器均支持 `baseUrl` 参数，可配置 API 中转站或自建代理：

| 适配器 | 文件 | 支持模型 | 上下文长度 | 特点 |
|--------|------|----------|------------|------|
| ClaudeAdapter | `adapters/claude.ts` | claude-opus-4, claude-sonnet-4, 等 | 200K tokens | 最优 PRD 生成，支持自定义 baseUrl |
| OpenAIAdapter | `adapters/openai.ts` | gpt-4o, gpt-4-turbo | 128K tokens | 通用任务，支持 API 中转站 |
| GeminiAdapter | `adapters/gemini.ts` | gemini-1.5-pro, gemini-1.5-flash | 1M tokens | 超大上下文 |
| GLMAdapter | `adapters/glm.ts` | glm-4, glm-4-air, glm-4.7 | 128K tokens | 中文优化，支持自定义 baseUrl |
| QwenAdapter | `adapters/qwen.ts` | qwen-max, qwen-plus, qwen-turbo | 30K tokens | 中文优化 |
| WenxinAdapter | `adapters/wenxin.ts` | ernie-4.0, ernie-speed | 8K tokens | 中文优化 |
| DeepSeekAdapter | `adapters/deepseek.ts` | deepseek-chat, deepseek-coder | 64K tokens | 代码任务，支持自定义 baseUrl |
| OllamaAdapter | `adapters/ollama.ts` | llama3, qwen2, 等本地模型 | 可配置 | 完全离线 |

### 6.3 模型管理器 (ModelManager)

**核心功能**：

1. **模型注册与缓存**：运行时注册并缓存所有可用适配器
2. **智能路由**：根据任务类型自动选择最佳模型
3. **降级策略**：首选模型不可用时自动切换到备用模型
4. **用户配置集成**：读取用户在 UI 配置的 API Key 和自选模型列表，动态重新初始化适配器
5. **三层模型来源**：系统环境变量 → 用户配置 → 动态获取（验证时）

**任务类型与模型偏好**（来自 `config/ai-models.yaml`）：

```yaml
preferences:
  prd_generation:   [claude-3.5-sonnet, gpt-4o, glm-4.7]
  chinese_content:  [glm-4.7, qwen-max, wenxin-4.0]
  code_tasks:       [gpt-4o, deepseek-chat]
  large_context:    [gemini-1.5-pro, claude-3.5-sonnet]
  cost_sensitive:   [glm-4.5-air, qwen-plus]
  privacy_mode:     [ollama-llama3, ollama-qwen]
```

### 6.4 图像生成

独立的图像管理器（`lib/ai/image-manager.ts`）支持：

- **通义万象 (Wanx)**：阿里云图像生成模型
- 支持：文生图、图生图、图像编辑
- 存储：生成的图像保存到资产系统

### 6.5 Prompt 工程

所有 Prompt 模板集中在 `lib/ai/prompts/` 目录：

| 文件 | 用途 |
|------|------|
| `prd-system.ts` | PRD 生成系统 Prompt（专业产品经理角色） |
| `prd-examples.ts` | Few-shot 示例（提升生成质量） |
| `conversation-system.ts` | 对话模式系统 Prompt |
| `prototype-system.ts` | 原型生成系统 Prompt |
| `logic-map-system.ts` | 逻辑图生成 Prompt |

---

## 7. RAG 引擎设计

### 7.1 处理管道

```
文档上传
    │
    ▼
RAG Pipeline (lib/rag/pipeline.ts)
    │
    ├─ 1. 格式检测 (PDF/DOCX/Markdown)
    │
    ├─ 2. 文本提取
    │     PDF   → pdf-parse
    │     DOCX  → mammoth
    │     MD    → 原生读取
    │
    ├─ 3. 文本分块 (TextSplitter)
    │     chunk_size = 1000 字符
    │     overlap   = 200 字符
    │     策略: 按段落优先，再按字符
    │
    ├─ 4. 向量化 (EmbeddingService)
    │     模型: text-embedding-3-small (OpenAI)
    │     维度: 1536
    │     批量处理: 每批 100 个 chunks
    │
    └─ 5. 持久化
          向量 → pgvector (document_chunks.embedding)
          全文 → tsvector (documents.search_vector)
```

### 7.2 文本分块策略

```typescript
class TextSplitter {
  constructor(
    private chunkSize: number = 1000,
    private overlap: number = 200
  ) {}

  // 优先按段落分割，保持语义完整性
  // 段落 > 句子 > 字符
  split(text: string): string[] { ... }
}
```

### 7.3 检索系统

#### 向量检索

```sql
-- 余弦相似度检索 (pgvector)
SELECT
  dc.content,
  dc.document_id,
  1 - (dc.embedding <=> $1) AS similarity  -- $1 = query embedding
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE d.workspace_id = $2
  AND 1 - (dc.embedding <=> $1) > 0.7     -- similarity_threshold
ORDER BY dc.embedding <=> $1
LIMIT 5;                                    -- top_k
```

#### 混合检索 (RRF 融合)

```typescript
async hybridSearch(query: string, options: SearchOptions) {
  // 1. 关键词检索
  const keywordResults = await this.keywordSearch(query, options)

  // 2. 向量检索
  const vectorResults = await this.vectorSearch(query, options)

  // 3. RRF 融合
  const k = 60
  const scores = new Map<string, number>()

  keywordResults.forEach((doc, rank) => {
    const score = scores.get(doc.id) || 0
    scores.set(doc.id, score + 1 / (k + rank + 1))
  })

  vectorResults.forEach((doc, rank) => {
    const score = scores.get(doc.id) || 0
    scores.set(doc.id, score + 1 / (k + rank + 1))
  })

  // 4. 按融合分数排序
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.topK)
    .map(([id]) => /* 获取完整文档 */)
}
```

### 7.4 Embedding 适配器

支持多种 Embedding 提供商：

| 提供商 | 模型 | 维度 |
|--------|------|------|
| OpenAI | text-embedding-3-small | 1536 |
| OpenAI | text-embedding-3-large | 3072 |
| GLM (智谱) | embedding-2 | 1024 |

注意：pgvector 对向量维度有 2000 的限制（IVFFlat 索引）。

---

## 8. PRD 生成引擎

### 8.1 生成流程

```typescript
class PRDGenerator {
  async generate(userInput: string, workspaceId: string): Promise<PRDDocument> {
    // 1. RAG 检索相关历史文档
    const retrievedDocs = await this.retriever.retrieve(userInput, {
      workspaceId,
      topK: 5,
      threshold: 0.7,
      mode: 'hybrid'
    })

    // 2. 构建 Prompt 上下文
    const context = buildContext(userInput, retrievedDocs)

    // 3. 选择最优模型
    const model = await modelManager.selectModel('prd_generation')

    // 4. AI 生成 (支持流式)
    const content = await model.generateText(context, {
      systemPrompt: PRD_SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 8000
    })

    // 5. 后处理 (质量验证 + 格式化)
    const validated = await qualityValidator.validate(content)

    // 6. 持久化
    return await prdDAO.create({
      content: validated,
      userInput,
      modelUsed: model.name,
      documentIds: retrievedDocs.map(d => d.id)
    })
  }
}
```

### 8.2 质量验证器

`lib/prd/quality-validator.ts` 检查 PRD 文档质量：

- 章节完整性（必需章节是否存在）
- Mermaid 图表语法有效性
- 内容最小长度
- 术语一致性

### 8.3 迭代优化引擎

`lib/prd/refinement-engine.ts` 支持多轮迭代：

- 用户追加对话时，携带完整历史上下文
- 智能合并修改，保持文档结构
- 版本追踪，支持回退

---

## 9. API 层设计

### 9.1 API 设计规范

所有 API 遵循 RESTful 风格：

- **URL 规范**：`/api/{resource}/{id}/{sub-resource}`
- **HTTP 方法**：GET（查询）、POST（创建）、PUT（全量更新）、PATCH（部分更新）、DELETE（删除）
- **响应格式**：`{ success: true, data: ... }` 或 `{ success: false, error: ... }`
- **认证**：Bearer Token (JWT)，通过 `Authorization` Header 传递
- **分页**：`?page=1&limit=20`

### 9.2 完整 API 端点目录

#### 认证 API (`/api/auth/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录（返回 JWT） |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| POST | `/api/auth/forgot-password` | 发送密码重置邮件 |
| POST | `/api/auth/reset-password` | 重置密码（Token 验证） |

#### 用户 API (`/api/user/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| PUT | `/api/user` | 更新用户资料 |
| PUT | `/api/user/password` | 修改密码 |
| POST | `/api/user/avatar` | 上传头像 |
| GET | `/api/user/avatar/:userId` | 获取用户头像 |

#### 文档 API (`/api/documents/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/documents` | 获取文档列表（支持分页、筛选） |
| POST | `/api/documents` | 创建文档记录 |
| POST | `/api/documents/upload` | 上传文档文件 |
| POST | `/api/documents/batch-upload` | 批量上传文档 |
| POST | `/api/documents/search` | 混合搜索 |
| GET | `/api/documents/duplicates` | 查找重复文档 |
| POST | `/api/documents/duplicates/cleanup` | 清理重复文档 |
| POST | `/api/documents/export` | 批量导出文档 |
| GET | `/api/documents/:id` | 获取文档详情 |
| PUT | `/api/documents/:id` | 更新文档元数据 |
| DELETE | `/api/documents/:id` | 删除文档 |
| GET | `/api/documents/:id/download` | 下载文档文件 |
| POST | `/api/documents/:id/share` | 创建分享链接 |
| GET | `/api/documents/:id/status` | 获取处理状态 |
| GET | `/api/documents/:id/logs` | 获取处理日志 |
| GET | `/api/documents/:id/chunks` | 获取文档块列表 |
| GET | `/api/documents/:id/usage` | 获取使用统计 |
| GET/POST/PUT | `/api/documents/:id/tags` | 标签管理 |
| PUT | `/api/documents/:id/category` | 更新文档分类 |

#### PRD API (`/api/prd/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/prd` | 获取 PRD 列表 |
| POST | `/api/prd` | 创建 PRD |
| POST | `/api/prd/stream` | 流式生成 PRD (SSE) |
| GET | `/api/prd/:id` | 获取 PRD 详情 |
| PATCH | `/api/prd/:id` | 更新 PRD |
| DELETE | `/api/prd/:id` | 删除 PRD |
| GET | `/api/prd/:id/logic-coverage` | 获取逻辑覆盖率 |
| GET | `/api/prd/:id/references` | 获取引用文档 |

#### 对话 API (`/api/chat/` & `/api/conversations/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/chat/stream` | 流式对话 (SSE) |
| GET | `/api/conversations/:prdId` | 获取对话历史 |
| PUT | `/api/conversations/:prdId` | 更新对话 |
| POST | `/api/conversations/save` | 保存对话 |

#### 原型 API (`/api/prototypes/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/prototypes` | 获取原型列表 |
| POST | `/api/prototypes` | 创建原型 |
| POST | `/api/prototypes/stream` | 流式生成原型 (SSE) |
| POST | `/api/prototypes/generate-from-prd` | 从 PRD 生成原型 |
| GET | `/api/prototypes/:id` | 获取原型详情 |
| PUT | `/api/prototypes/:id` | 更新原型 |
| DELETE | `/api/prototypes/:id` | 删除原型 |
| GET | `/api/prototypes/:id/pages` | 获取原型页面列表 |
| PUT | `/api/prototypes/:id/pages/:pageId` | 更新原型页面 |

#### 图像资产 API (`/api/assets/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/assets` | 获取资产列表 |
| POST | `/api/assets/upload` | 上传图像 |
| POST | `/api/assets/generate` | AI 生成图像 |
| POST | `/api/assets/edit` | AI 编辑图像 |
| GET | `/api/assets/models` | 获取可用图像模型 |
| GET | `/api/assets/prd/:prdId` | 获取 PRD 关联图像 |
| DELETE | `/api/assets/:id` | 删除资产 |

#### 工作区 API (`/api/workspaces/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/workspaces` | 获取工作区列表 |
| POST | `/api/workspaces` | 创建工作区 |
| GET | `/api/workspaces/:id` | 获取工作区详情 |
| PATCH | `/api/workspaces/:id` | 更新工作区 |
| DELETE | `/api/workspaces/:id` | 删除工作区 |
| POST | `/api/workspaces/:id/set-default` | 设为默认工作区 |

#### AI 配置 API (`/api/ai/`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/ai/models` | 获取可用模型列表 |
| GET | `/api/ai/providers` | 获取提供商列表 |
| GET | `/api/ai/configs` | 获取用户 API 配置 |
| POST | `/api/ai/configs` | 创建 API 配置 |
| DELETE | `/api/ai/configs/:provider` | 删除 API 配置 |
| PATCH | `/api/ai/configs/:provider/toggle` | 启用/禁用配置 |
| POST | `/api/ai/configs/validate` | 验证 API Key 有效性 |

#### 其他 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/stats` | 系统统计数据 |
| GET | `/api/share/:token` | 公开分享访问 |
| GET | `/api/logic-maps/:id` | 获取逻辑图 |
| POST | `/api/logic-maps/generate-from-prd` | 从 PRD 生成逻辑图 |
| GET | `/api/logic-coverage/batch` | 批量获取覆盖率 |
| GET/POST/PATCH/DELETE | `/api/tags/*` | 标签管理 |
| GET/POST/PATCH/DELETE | `/api/categories/*` | 分类管理 |

### 9.3 流式 API 规范 (SSE)

流式 API 使用 Server-Sent Events：

```
POST /api/prd/stream
Content-Type: application/json

{
  "userInput": "设计用户登录功能",
  "workspaceId": "uuid",
  "modelId": "glm-4.7",  // 可选，默认自动选择
  "documentIds": ["uuid1", "uuid2"]  // 可选，指定参考文档
}

Response: text/event-stream
data: {"type":"chunk","content":"# 用户登录"}
data: {"type":"chunk","content":"\n\n## 功能概述"}
data: {"type":"done","prdId":"uuid","metadata":{...}}
```

### 9.4 错误响应格式

```typescript
// HTTP 400 Bad Request
{
  "statusCode": 400,
  "message": "工作区 ID 不能为空",
  "data": null
}

// HTTP 401 Unauthorized
{
  "statusCode": 401,
  "message": "未授权，请先登录"
}

// HTTP 404 Not Found
{
  "statusCode": 404,
  "message": "文档不存在"
}

// HTTP 500 Internal Server Error
{
  "statusCode": 500,
  "message": "服务器内部错误"
}
```

---

## 10. 前端架构设计

### 10.1 页面结构

| 路由 | 页面文件 | 布局 | 描述 |
|------|----------|------|------|
| `/` | `pages/index.vue` | default | 产品首页（Landing Page） |
| `/login` | `pages/login.vue` | auth | 用户登录 |
| `/register` | `pages/register.vue` | auth | 用户注册 |
| `/forgot-password` | `pages/forgot-password.vue` | auth | 忘记密码 |
| `/reset-password` | `pages/reset-password.vue` | auth | 重置密码 |
| `/generate` | `pages/generate.vue` | chat | PRD 生成主界面（双栏布局） |
| `/knowledge-base` | `pages/knowledge-base.vue` | dashboard | 知识库文档管理 |
| `/prototypes` | `pages/prototypes.vue` | dashboard | 原型列表管理 |
| `/projects/:id` | `pages/projects/[id].vue` | dashboard | PRD 项目详情 |
| `/documents/:id` | `pages/documents/[id].vue` | dashboard | 文档详情 |
| `/prototype/:id` | `pages/prototype/[id].vue` | dashboard | 原型编辑器 |
| `/settings/profile` | `pages/settings/profile.vue` | dashboard | 用户资料 & AI 模型配置（Profile/Security/Models 三个 Tab） |
| `/app` | `pages/app.vue` | - | App 路由入口 |

### 10.2 布局系统

| 布局 | 文件 | 适用场景 |
|------|------|----------|
| default | `layouts/default.vue` | 首页，带导航栏 |
| dashboard | `layouts/dashboard.vue` | 主应用，带侧边栏 |
| chat | `layouts/chat.vue` | PRD 生成页，全屏布局 |
| auth | `layouts/auth.vue` | 登录/注册，居中卡片 |

### 10.3 组件架构

#### UI 基础组件 (components/ui/) - shadcn/ui

| 组件 | 说明 |
|------|------|
| Button | 按钮（多种变体：default/outline/ghost/destructive） |
| Input, Label, Textarea | 表单输入 |
| Select | 下拉选择 |
| Card | 卡片容器 |
| Dialog, AlertDialog | 模态对话框 |
| DropdownMenu | 下拉菜单 |
| Tabs | 标签页 |
| Badge | 徽章标签 |
| Avatar | 用户头像 |
| Table | 数据表格 |
| Tooltip | 提示框 |
| Progress | 进度条 |
| Switch | 开关 |
| Skeleton | 骨架屏 |
| ScrollArea | 自定义滚动区域 |
| Sheet | 侧边抽屉 |
| Separator | 分隔线 |
| Breadcrumb | 面包屑导航 |
| Sidebar (18 个子组件) | 侧边栏完整系统 |
| Popover | 弹出框 |
| Checkbox | 复选框 |
| NavigationMenu | 顶部导航菜单 |

#### 功能组件

**Chat 模块** (`components/chat/`)

| 组件 | 功能 |
|------|------|
| MessageInput.vue | 消息输入框，含模型选择器 |
| MessageList.vue | 对话历史展示 |
| MessageBubble.vue | 单条消息气泡 |
| PRDPreview.vue | PRD 内容实时预览 |
| TargetSelector.vue | 生成目标切换（PRD/原型） |

**Prototype 模块** (`components/prototype/`)

| 组件 | 功能 |
|------|------|
| PrototypePreview.vue | iframe 原型预览（DOMPurify 净化） |
| PrototypeCodeEditor.vue | Monaco 代码编辑器 |
| PrototypeToolbar.vue | 工具栏（缩放、设备切换） |
| PrototypePageNavigator.vue | 多页导航 |
| PrototypeTab.vue | 标签容器 |

**Documents 模块** (`components/documents/`)

| 组件 | 功能 |
|------|------|
| DocumentUpload.vue | 文件拖拽上传，进度显示 |
| DocumentList.vue | 文档列表，支持筛选排序 |

**Logic Map 模块** (`components/logic-map/`)

- 基于 @vue-flow/core 构建的可视化逻辑图
- 支持多种节点类型和连接线样式

### 10.4 Composables (组合式函数)

| Composable | 主要功能 |
|-----------|----------|
| `useAiModels.ts` | AI 模型列表获取，当前模型选择 |
| `useApiConfigs.ts` | 用户 API Key 配置管理 |
| `useAssets.ts` | 图像资产上传和 AI 生成 |
| `useConversation.ts` | 对话状态管理，消息历史 |
| `useLogicMap.ts` | 逻辑图数据获取和生成 |
| `usePrdGenerator.ts` | PRD 生成流程控制，流式接收 |
| `usePrototype.ts` | 原型创建、编辑、页面管理 |
| `useWorkspace.ts` | 工作区切换，成员管理 |

### 10.5 Pinia 状态管理

| Store | 状态内容 |
|-------|----------|
| `stores/auth.ts` | 当前用户信息、JWT Token、登录状态 |
| `stores/documents.ts` | 文档列表、过滤条件、分页状态 |
| `stores/prd.ts` | 当前 PRD 文档、元数据 |

### 10.6 主题系统

- **深色/浅色模式**：通过 `@nuxtjs/color-mode` 实现，`class` 策略
- **主色调**：通过 Tailwind CSS 和 CSS 变量定义
- **组件样式**：使用 `cn()` 函数（clsx + tailwind-merge）合并类名

---

## 11. 存储系统设计

### 11.1 存储抽象层

```typescript
interface StorageAdapter {
  upload(file: Buffer, key: string, contentType: string): Promise<string>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
  exists(key: string): Promise<boolean>
}
```

### 11.2 存储提供商

| 提供商 | 适用场景 | 配置 |
|--------|----------|------|
| 华为云 OBS | 生产环境 | `STORAGE_PROVIDER=huawei-obs` |

华为云 OBS 通过 S3 兼容 API（`@aws-sdk/client-s3`）实现。

### 11.3 文件组织结构

```
bucket/
├── documents/
│   ├── {userId}/
│   │   └── {documentId}/{filename}
│   └── versions/
│       └── {documentId}/{versionNumber}/{filename}
├── avatars/
│   └── {userId}/avatar.{ext}
└── assets/
    └── {userId}/
        └── {assetId}/{filename}
```

### 11.4 安全策略

- **预签名 URL**：文件下载使用有时限预签名 URL（默认 1 小时）
- **访问控制**：所有文件操作需验证用户所有权
- **文档分享**：生成一次性或有时限的分享令牌

---

## 12. 认证与安全

### 12.1 认证流程

全局认证中间件 (`server/middleware/01.auth.ts`) 拦截所有 `/api/` 请求：

```
1. 用户登录 → POST /api/auth/login
2. 服务端验证密码 (bcrypt.compare)
3. 生成 JWT Token (jsonwebtoken, 7天有效期)
4. 客户端存储 Token (Cookie: auth_token)
5. 后续请求中间件自动验证 Token → 提取 userId 注入 event.context
6. 各端点调用 requireAuth(event) 获取 userId，权限不足自动抛出 401

白名单路径（无需认证）:
- /api/auth/login
- /api/auth/register
- /api/auth/forgot-password
- /api/auth/reset-password
- /api/health
- /api/share/
```

### 12.2 认证工具函数

```typescript
// server/utils/auth-helpers.ts

// 获取当前登录用户 ID（未认证时抛出 401）
const userId = requireAuth(event)

// 验证资源归属权（非所有者抛出 403，null userId 兼容历史数据）
requireResourceOwner(resource, currentUserId)
```

### 12.3 密码安全

- 存储：bcrypt 哈希（cost factor 12）
- 重置：基于 Token 的邮件重置流程
- Token：随机 UUID，1小时过期

### 12.4 API Key 加密与用户隔离

用户配置的第三方 AI API Key 使用 AES-256 加密存储，并按用户完全隔离：

```typescript
// 加密存储（绑定用户 ID）
const encrypted = encrypt(apiKey, process.env.ENCRYPTION_KEY)
await userApiConfigDAO.upsert(userId, { provider, apiKeyEncrypted: encrypted, models })

// 使用时按用户查询并解密
const config = await userApiConfigDAO.getFullConfig(userId, provider)
const apiKey = decrypt(config.apiKeyEncrypted, process.env.ENCRYPTION_KEY)
```

### 12.5 已知安全限制

- 缺少 CSRF 保护
- 缺少 Rate Limiting
- 缺少请求日志审计
- 计划在 v0.2.0 版本加强

---

## 13. 国际化设计

支持中文（简体）和英文双语：

- 配置：`nuxt.config.ts` 中的 `@nuxtjs/i18n` 模块
- 语言文件：`lang/zh-CN.json` 和 `lang/en.json`
- 默认语言：中文（`defaultLocale: 'zh-CN'`）
- 策略：无前缀（`strategy: 'no_prefix'`）
- 浏览器语言检测：使用 Cookie 记忆用户选择

---

## 14. 部署与运维

### 14.1 环境要求

| 依赖 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18 | 20 LTS |
| pnpm | 8 | 9 |
| PostgreSQL | 14 | 16 |
| pgvector | 0.5 | 0.7 |

### 14.2 本地开发环境搭建

```bash
# 1. 克隆项目
git clone <repo-url>
cd ArchMind

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，配置数据库和 AI API Key

# 4. 初始化 PostgreSQL
# 确保 PostgreSQL 14+ 已安装并启动
# 创建数据库: createdb archmind

# 5. 启用 pgvector 扩展
psql archmind -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql archmind -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# 6. 初始化数据库表结构
pnpm db:init

# 7. 添加全文检索支持
pnpm tsx scripts/add-fulltext-search.ts

# 8. 添加版本控制支持
pnpm tsx scripts/add-version-control.ts

# 9. 启动开发服务器
pnpm dev

# 访问 http://localhost:3000
```

### 14.3 Docker 部署

项目提供了完整的 Docker 支持：

**Dockerfile** (多阶段构建)：

```dockerfile
# Stage 1: 安装依赖
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# Stage 2: 构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 3: 运行时
FROM node:20-alpine AS runner
WORKDIR /app
# 非 root 用户运行
RUN addgroup -S nuxt && adduser -S -G nuxt nuxt
COPY --from=builder /app/.output ./.output
USER nuxt
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O- http://localhost:3000/api/health
CMD ["node", ".output/server/index.mjs"]
```

**docker-compose.yml** (完整服务栈)：

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://archmind:password@postgres:5432/archmind
      # ... 其他环境变量
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: archmind
      POSTGRES_PASSWORD: password
      POSTGRES_DB: archmind
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U archmind"]
      interval: 5s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    profiles: ["production"]
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/ssl:/etc/nginx/ssl

volumes:
  postgres_data:
```

```bash
# 开发环境启动
docker compose up -d

# 生产环境启动（含 nginx）
docker compose --profile production up -d
```

### 14.4 环境变量完整参考

```bash
# ==================== 数据库 ====================
DATABASE_URL=postgresql://user:pass@localhost:5432/archmind
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ==================== 对象存储 ====================
STORAGE_PROVIDER=huawei-obs

# 华为云 OBS (生产)
HUAWEI_OBS_REGION=cn-north-4
HUAWEI_OBS_ACCESS_KEY=your-access-key
HUAWEI_OBS_SECRET_KEY=your-secret-key
HUAWEI_OBS_BUCKET_NAME=archmind
HUAWEI_OBS_ENDPOINT=https://obs.cn-north-4.myhuaweicloud.com

# ==================== AI 模型 ====================
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
GLM_API_KEY=...
DASHSCOPE_API_KEY=...          # 通义千问
BAIDU_API_KEY=...              # 文心一言
BAIDU_SECRET_KEY=...
DEEPSEEK_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434

# ==================== RAG 配置 ====================
EMBEDDING_MODEL=text-embedding-3-small
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K=5
SIMILARITY_THRESHOLD=0.7

# ==================== AI 默认配置 ====================
DEFAULT_MODEL=glm-4.7
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=8000

# ==================== 邮件 (密码重置) ====================
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your@qq.com
EMAIL_PASS=your-auth-code
EMAIL_FROM=ArchMind <your@qq.com>

# ==================== 安全 ====================
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-32-char-key-for-api-keys

# ==================== 应用 ====================
APP_URL=http://localhost:3000
NODE_ENV=development
```

### 14.5 生产环境建议

1. **数据库连接池**：`DATABASE_POOL_MIN=5, DATABASE_POOL_MAX=20`
2. **存储**：使用华为云 OBS 或其他云存储
3. **进程管理**：使用 PM2 或 Docker 保证进程存活
4. **反向代理**：Nginx 处理 SSL、静态资源缓存
5. **监控**：计划集成 Sentry (v0.2.0)
6. **备份**：定期备份 PostgreSQL 数据库

---

## 15. 开发规范

### 15.1 目录约定

| 目录 | 约定 |
|------|------|
| `pages/` | 页面文件，遵循 Nuxt 3 文件路由规范 |
| `components/ui/` | 只放 shadcn/ui 组件，不放业务组件 |
| `components/*/` | 按功能模块分类的业务组件 |
| `composables/` | `use` 前缀，处理可复用的响应式逻辑 |
| `stores/` | Pinia store，按业务领域划分 |
| `lib/` | 纯 TypeScript 业务逻辑（无框架依赖） |
| `server/api/` | API 路由，文件名 = HTTP 方法后缀 |
| `types/` | 全局 TypeScript 类型定义 |

### 15.2 Vue 组件规范

```vue
<script setup lang="ts">
// 1. 框架导入
import { ref, computed, onMounted } from 'vue'

// 2. UI 组件导入（只用 shadcn/ui）
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

// 3. 类型定义
interface Props {
  title: string
  disabled?: boolean
}

// 4. Props 与 Emits
const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  submit: [value: string]
}>()

// 5. 响应式状态
const value = ref('')
const isLoading = ref(false)

// 6. 计算属性
const buttonLabel = computed(() =>
  isLoading.value ? '处理中...' : '提交'
)

// 7. 方法
async function handleSubmit() {
  isLoading.value = true
  try {
    emit('submit', value.value)
  } finally {
    isLoading.value = false
  }
}

// 8. 生命周期
onMounted(() => {
  // 初始化逻辑
})
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold">{{ title }}</h2>
    <Input v-model="value" placeholder="输入内容" />
    <Button :disabled="disabled || isLoading" @click="handleSubmit">
      {{ buttonLabel }}
    </Button>
  </div>
</template>
```

### 15.3 API 路由规范

```typescript
// server/api/documents/index.get.ts
import { z } from 'zod'
import { documentDAO } from '~/lib/db/dao/document-dao'

const QuerySchema = z.object({
  workspaceId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export default defineEventHandler(async (event) => {
  // 1. 输入验证
  const query = await getValidatedQuery(event, QuerySchema.parse)

  // 2. 权限检查
  const userId = event.context.userId
  if (!userId) throw createError({ statusCode: 401, message: '未授权' })

  // 3. 业务逻辑
  const result = await documentDAO.findByWorkspace(
    query.workspaceId, query.page, query.limit
  )

  // 4. 返回结果
  return { success: true, data: result }
})
```

### 15.4 DAO 规范

```typescript
// lib/db/dao/document-dao.ts
export class DocumentDAO {
  async findById(id: string): Promise<Document | null> { ... }
  async findByWorkspace(workspaceId: string, page = 1, limit = 20): Promise<PaginatedResult<Document>> { ... }
  async create(data: CreateDocumentInput): Promise<Document> { ... }
  async update(id: string, data: UpdateDocumentInput): Promise<Document> { ... }
  async delete(id: string): Promise<void> { ... }
}

// 导出单例
export const documentDAO = new DocumentDAO()
```

### 15.5 提交规范 (Conventional Commits)

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: add image generation API` |
| `fix` | Bug 修复 | `fix: resolve JWT token expiry issue` |
| `docs` | 文档更新 | `docs: update API reference` |
| `refactor` | 重构 | `refactor(ai): improve adapter pattern` |
| `test` | 测试 | `test: add unit tests for RAG retriever` |
| `chore` | 工具/依赖 | `chore: upgrade drizzle-orm to 0.30` |
| `style` | 代码格式 | `style: fix eslint warnings` |
| `perf` | 性能优化 | `perf: optimize vector search query` |

---

## 16. 测试策略

### 16.1 测试框架配置

- **框架**：Vitest ^4.0.18
- **DOM 环境**：happy-dom
- **组件测试**：@vue/test-utils
- **Mock**：msw (Mock Service Worker)
- **覆盖率**：@vitest/coverage-v8

### 16.2 当前测试覆盖

| 测试文件 | 覆盖内容 |
|----------|----------|
| `tests/unit/lib/ai/manager.test.ts` | AI 模型管理器的注册、路由、降级逻辑 |
| `tests/unit/lib/ai/adapters/claude.test.ts` | Claude 适配器的基本功能 |
| `tests/unit/lib/prd/generator.test.ts` | PRD 生成器的核心流程 |
| `tests/unit/lib/prd/quality-validator.test.ts` | PRD 质量验证规则 |
| `tests/unit/lib/rag/text-splitter.test.ts` | 文本分块算法 |
| `tests/unit/lib/db/dao/document-dao.test.ts` | 文档 DAO 的 CRUD 操作 |
| `tests/unit/composables/useAiModels.test.ts` | AI 模型 Composable |

**当前覆盖率：~15%（目标：80%）**

### 16.3 测试命令

```bash
pnpm test              # 运行所有测试
pnpm test:watch        # 监听模式
pnpm test:coverage     # 生成覆盖率报告
pnpm test:ui           # Vitest UI 界面
```

### 16.4 测试最佳实践

```typescript
// tests/unit/lib/rag/text-splitter.test.ts
import { describe, it, expect } from 'vitest'
import { TextSplitter } from '~/lib/rag/text-splitter'

describe('TextSplitter', () => {
  it('should split text into chunks of correct size', () => {
    const splitter = new TextSplitter(100, 20)
    const text = 'a'.repeat(250)
    const chunks = splitter.split(text)

    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(100)
    })
  })

  it('should apply overlap between consecutive chunks', () => {
    const splitter = new TextSplitter(100, 20)
    const text = 'a'.repeat(200)
    const chunks = splitter.split(text)

    // 相邻块应有重叠
    if (chunks.length >= 2) {
      const overlap = chunks[0].slice(-20)
      expect(chunks[1].startsWith(overlap)).toBe(true)
    }
  })
})
```

---

## 17. 性能优化

### 17.1 数据库优化

#### 索引策略

```sql
-- 向量检索优化
CREATE INDEX idx_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- lists 参数根据数据量调整

-- 全文检索优化
CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);

-- 组合查询优化
CREATE INDEX idx_documents_workspace_status ON documents(workspace_id, status);
CREATE INDEX idx_prd_workspace_created ON prd_documents(workspace_id, created_at DESC);
```

#### 连接池配置

```bash
DATABASE_POOL_MIN=2   # 最小连接数
DATABASE_POOL_MAX=10  # 最大连接数（生产环境建议 20）
```

### 17.2 AI 调用优化

- **流式输出**：所有 AI 生成接口均支持 SSE 流式返回，提升感知性能
- **模型路由**：根据任务类型选择最经济的模型（如成本敏感任务使用 GLM-4.5-Air）
- **批量向量化**：文档分块后批量发送 embedding 请求（每批 100 个）

### 17.3 前端优化

- **代码分割**：Nuxt 3 自动按路由分割 JS Bundle
- **图片优化**：使用预签名 URL 直接从 CDN/OBS 加载
- **骨架屏**：所有列表和详情页使用 Skeleton 组件占位
- **虚拟滚动**：大量文档列表考虑虚拟滚动（计划中）

### 17.4 API 性能指标

| 接口 | P50 响应时间 | P99 响应时间 |
|------|-------------|-------------|
| 文档列表 | < 100ms | < 500ms |
| 混合搜索 (1K 文档) | < 500ms | < 2s |
| PRD 流式生成（首 Token） | < 2s | < 5s |
| 批量上传 (10 文件/5MB) | 8s | 15s |

---

## 18. 项目路线图

### v0.1.0 (当前 - 2026-02-16)

**已完成的核心功能**：
- 文档管理（上传、版本控制、批量操作、去重）
- RAG 引擎（向量搜索、全文搜索、混合搜索）
- PRD 生成（对话式、流式、多模型）
- 原型系统（HTML 生成、多页管理、设备预览）
- 逻辑图生成与覆盖率分析
- 图像生成（AI 文生图、图像编辑）
- 用户系统（注册、登录、密码重置）
- 多工作区支持
- 用户自定义 AI API Key
- Docker 部署支持
- 标签与分类系统

### v0.2.0 (计划中)

**新增**：
- Redis 缓存层（减少 AI API 重复调用）
- Rate Limiting（防止 API 滥用）
- CSRF 保护
- Sentry 错误监控
- 混合搜索重排序（Cross-Encoder 重排）
- 审计日志

**改进**：
- 测试覆盖率提升至 60%+
- 数据库查询优化
- API 错误信息规范化

### v0.3.0 (计划中)

**新增**：
- WebSocket 实时协作
- 团队成员管理
- Webhook 支持（集成外部系统）
- OpenAPI 文档自动生成
- 国际化完善（更多语言）

**改进**：
- E2E 测试覆盖（Playwright）
- CI/CD 流程（GitHub Actions）
- Docker Compose 生产配置优化

### v1.0.0 (计划中)

**新增**：
- RBAC 权限系统（管理员、成员、访客）
- 批量导出/导入（Word、PDF）
- 插件系统（第三方集成）
- Kubernetes 部署配置
- 多租户 SaaS 模式支持

---

## 19. 已知问题与限制

### 19.1 当前限制

| 问题 | 影响 | 状态 |
|------|------|------|
| 测试覆盖率低 (~15%) | 回归测试风险高 | 待改进 |
| 缺少混合搜索重排序 | 搜索结果排序不够精准 | 待实现 |
| pgvector 2000 维度限制 | IVFFlat 索引不支持 >2000 维 | 已知限制，选模型时注意 |
| 无 Rate Limiting | API 可能被滥用 | v0.2.0 计划 |
| 无 CSRF 保护 | 跨站请求伪造风险 | v0.2.0 计划 |
| 无缓存层 | 相似查询重复计算 | v0.2.0 计划 |
| 邮件配置硬编码 QQ SMTP | 不灵活 | 低优先级 |

### 19.2 数据安全注意事项

- 用户 API Key 使用 AES 加密，但 `ENCRYPTION_KEY` 需妥善保管
- JWT 令牌存在客户端，建议设置合理有效期（当前 7 天）
- 文档内容会发送给 AI 提供商（用户应知晓）
- 本地 Ollama 模式可实现完全私有化

---

## 20. 术语表

| 术语 | 全称 | 解释 |
|------|------|------|
| RAG | Retrieval-Augmented Generation | 检索增强生成，结合知识库检索和 AI 生成 |
| PRD | Product Requirements Document | 产品需求文档 |
| SSE | Server-Sent Events | 服务端推送事件，用于流式输出 |
| RRF | Reciprocal Rank Fusion | 倒数排名融合，混合搜索算法 |
| pgvector | - | PostgreSQL 的向量搜索扩展 |
| IVFFlat | Inverted File with Flat Quantization | pgvector 的向量索引算法 |
| GIN | Generalized Inverted Index | PostgreSQL 广义倒排索引（用于全文搜索） |
| DAO | Data Access Object | 数据访问对象，封装数据库操作 |
| JWT | JSON Web Token | 用于无状态认证的令牌格式 |
| OBS | Object Storage Service | 华为云对象存储服务 |
| SSR | Server-Side Rendering | 服务端渲染 |
| SPA | Single Page Application | 单页应用 |
| Embedding | - | 文本的向量化表示，用于语义搜索 |
| Chunk | - | 文档分块，RAG 处理的基本单元 |
| Adapter | - | 适配器模式，统一不同 AI 提供商的接口 |
| Composable | - | Vue 3 组合式函数，封装可复用逻辑 |
| Store | - | Pinia 状态管理，管理全局响应式状态 |

---

*最后更新：2026-02-24 | 版本：0.1.1*

*ArchMind AI - 让每一份历史文档都成为新功能的基础*
