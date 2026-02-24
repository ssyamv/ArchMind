# CLAUDE.md

> AI 开发助手指南 - Claude Code 专用项目配置

---

## 项目概述

**ArchMind AI** 是一个本地运行的 MVP 工具，通过 RAG（检索增强生成）技术将历史文档转化为产品需求文档（PRD）和原型。

**核心价值**: 让每一份历史文档都成为新功能的基础，消除产品迭代中的逻辑断层。

### 项目状态

| 指标 | 状态 |
|------|------|
| 版本 | 0.1.1 |
| 框架 | Nuxt 3.21 + Vue 3.5 + TypeScript 5.9 |
| 数据库 | PostgreSQL 14+ + pgvector |
| 组件 | 209 个 (30+ shadcn/ui) |
| API 端点 | 103 个 |
| 测试覆盖率 | ~15% (目标 80%) |

---

## 关键规则

### 1. 自动使用 Context7 MCP

**编写涉及任何库/框架的代码时，必须主动使用 Context7 MCP**：

```
1. 调用 resolve-library-id → query-docs
2. 优先使用检索到的文档，而非训练数据
```

**适用场景**: Nuxt 3, Zod, LangChain.js, pgvector, Pinia, shadcn/ui, Drizzle ORM 等

### 2. UI 组件标准

**只使用 shadcn/ui (Vue) 组件** - 从 `~/components/ui/*` 导入

| 规则 | 说明 |
|------|------|
| ✅ 使用 | shadcn/ui 组件 |
| ❌ 禁止 | Nuxt UI, PrimeVue, Element Plus 等 |
| ❌ 禁止 | 当 shadcn/ui 有等效组件时自定义实现 |
| ✅ 样式 | 仅使用 Tailwind CSS |
| ✅ 条件类 | 使用 `cn()` 工具函数 |

**实现前检查清单**:
- [ ] 查看 [shadcn-vue 文档](https://www.shadcn-vue.com)
- [ ] 检查 `~/components/ui/` 目录

### 3. 动效库标准

**使用 vue-bits 实现视觉效果和动画** - https://vue-bits.dev

| 优先级 | 方案 |
|--------|------|
| 1 | vue-bits 组件 |
| 2 | 自定义 CSS 动画 |
| 3 | 其他动画库 |

**安装位置**: `~/components/ui/bits/`

**可用组件**: ShinyText, Aurora, SplitText, GlitchText 等

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Nuxt 3 | ^3.21.0 |
| 语言 | TypeScript | ^5.9.3 |
| UI | shadcn/ui (Vue) | radix-vue ^1.9.17 |
| 样式 | Tailwind CSS | ^3.4.19 |
| 动效 | vue-bits | - |
| 数据库 | PostgreSQL + pgvector | 14+ |
| ORM | Drizzle ORM | ^0.29.5 |
| 状态管理 | Pinia | ^2.3.1 |
| 表单 | VeeValidate + Zod | ^4.15.0 / ^3.25.0 |
| AI | LangChain.js | ^0.1.37 |
| 测试 | Vitest | ^4.0.18 |

---

## 项目结构

```
ArchMind/
├── pages/                    # Nuxt 3 页面（文件路由）
│   ├── index.vue            # 首页
│   ├── documents/           # 文档管理
│   ├── prd/                 # PRD 管理
│   ├── prototype/           # 原型预览
│   ├── workspace/           # 工作区
│   └── profile/             # 用户设置
│
├── server/                   # Nuxt 3 服务端
│   ├── api/                 # API 路由（103 个文件）
│   │   ├── documents/       # 文档管理 API
│   │   ├── prd/             # PRD 生成 API
│   │   ├── chat/            # 对话 API
│   │   ├── workspace/       # 工作区 API
│   │   ├── ai/              # AI 配置 API
│   │   └── auth/            # 认证 API
│   ├── middleware/          # 服务端中间件
│   │   └── 01.auth.ts       # 全局 JWT 认证中间件
│   └── utils/               # 服务端工具
│       └── auth-helpers.ts  # 认证工具函数
│
├── components/               # Vue 组件（209 个）
│   ├── ui/                  # shadcn/ui 组件（30+）
│   ├── chat/                # 对话组件
│   ├── documents/           # 文档组件
│   ├── projects/            # 项目组件
│   ├── prototype/           # 原型组件
│   ├── logic-map/           # 逻辑图组件
│   └── common/              # 通用组件
│
├── composables/              # Vue Composables（8 个）
│   ├── useAuth.ts           # 认证逻辑
│   ├── useDocuments.ts      # 文档操作
│   ├── useAiModels.ts       # AI 模型
│   └── useWorkspace.ts      # 工作区
│
├── stores/                   # Pinia 状态管理（3 个）
│   ├── auth.ts              # 认证状态
│   ├── workspace.ts         # 工作区状态
│   └── sidebar.ts           # 侧边栏状态
│
├── lib/                      # 核心业务逻辑
│   ├── ai/                  # AI 服务层
│   │   ├── adapters/        # 模型适配器（8 个，均支持自定义 baseUrl）
│   │   ├── manager.ts       # 模型管理器（支持用户配置动态初始化）
│   │   └── config.ts        # 配置解析
│   ├── rag/                 # RAG 检索引擎
│   │   ├── document-processor.ts
│   │   ├── text-splitter.ts
│   │   ├── embeddings.ts
│   │   └── retriever.ts
│   ├── prd/                 # PRD 生成引擎
│   ├── prototype/           # 原型生成
│   ├── logic-map/           # 逻辑图
│   ├── db/                  # 数据库层
│   │   ├── schema.ts        # 表结构定义
│   │   └── dao/             # 数据访问层（15 个，均支持 userId 隔离）
│   ├── storage/             # 对象存储
│   ├── auth/                # 认证逻辑
│   ├── chat/                # 对话引擎
│   └── utils/               # 工具函数
│
├── types/                    # TypeScript 类型定义（14 个）
├── config/                   # YAML 配置文件
├── migrations/               # 数据库迁移
├── scripts/                  # 工具脚本（20 个）
├── tests/                    # 测试文件（9 个）
└── docs/                     # 项目文档
```

---

## 核心架构

### 1. 多模型 AI 适配器

统一接口支持多个 AI 提供商：

```typescript
interface AIModelAdapter {
  readonly name: string
  readonly provider: string
  readonly maxTokens: number

  generateText(prompt: string, options?: GenerateOptions): Promise<string>
  generateStream(prompt: string, options?: GenerateOptions): AsyncIterator<string>
  generateStructured<T>(prompt: string, schema: JSONSchema): Promise<T>
  estimateCost(inputTokens: number, outputTokens: number): number
}
```

**已实现的适配器**:

| 提供商 | 模型 | 适用场景 |
|--------|------|----------|
| Anthropic | Claude 3.5 Sonnet | PRD 生成 |
| OpenAI | GPT-4o | 通用任务 |
| Google | Gemini 1.5 Pro | 大上下文 (200K) |
| 智谱 AI | GLM-4, GLM-4.5 Air | 中文优化 |
| 阿里云 | 通义千问 | 中文优化 |
| 百度 | 文心一言 | 中文优化 |
| DeepSeek | DeepSeek Chat | 代码任务 |
| Ollama | 本地模型 | 隐私模式 |

**模型选择策略** (config/ai-models.yaml):

```yaml
ai_models:
  default: glm-4
  fallback: [glm-4.5-air, gpt-4o, claude-3.5-sonnet]
  preferences:
    prd_generation: [claude-3.5-sonnet, gpt-4o, glm-4]
    chinese_content: [glm-4, qwen-max, wenxin-4.0]
    code_tasks: [gpt-4o, deepseek-chat]
    large_context: [gemini-1.5-pro]
```

### 2. RAG 管道

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Load   │───▶│  Split  │───▶│  Embed  │───▶│  Store  │───▶│ Retrieve│
│         │    │         │    │         │    │         │    │         │
│PDF/DOCX │    │1000/200 │    │ Vector  │    │pgvector │    │  Top-5  │
│ Markdown│    │ chunks  │    │1536-dim │    │  Table  │    │ thresh= │
│         │    │         │    │         │    │         │    │  0.7    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 3. PRD 生成流程

```
User Input → RAG Retrieval → Context Building → Model Selection
    → AI Generation (Stream) → Post-processing → Database Persistence
```

---

## 数据库设计

### 核心表

| 表名 | 描述 |
|------|------|
| `workspaces` | 工作区（多租户） |
| `users` | 用户 |
| `workspace_members` | 工作区成员 |
| `documents` | 文档 |
| `document_chunks` | 文档块（向量检索） |
| `document_versions` | 文档版本 |
| `prd_documents` | PRD 文档 |
| `prd_document_references` | PRD 引用 |
| `conversations` | 对话 |
| `conversation_messages` | 对话消息 |
| `prototypes` | 原型 |
| `prototype_pages` | 原型页面 |
| `user_api_configs` | 用户 API 配置（含 user_id 隔离、models 字段） |
| `tags` | 标签 |
| `categories` | 分类 |

### 关键索引

```sql
-- 向量索引 (IVFFlat)
CREATE INDEX idx_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 全文检索 (GIN)
CREATE INDEX idx_documents_search
ON documents USING GIN(search_vector);
```

---

## 开发命令

```bash
# 安装
pnpm install

# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm preview          # 预览生产构建

# 代码质量
pnpm lint             # ESLint 检查
pnpm lint:fix         # 自动修复
pnpm typecheck        # TypeScript 类型检查

# 测试
pnpm test             # 运行测试
pnpm test:coverage    # 测试覆盖率
pnpm test:watch       # 监听模式

# 数据库
pnpm db:init          # 初始化数据库
pnpm db:seed          # 添加测试数据
```

---

## 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/archmind
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# 存储提供商
STORAGE_PROVIDER=huawei-obs

# 华为云 OBS
HUAWEI_OBS_REGION=cn-north-4
HUAWEI_OBS_ACCESS_KEY=your-access-key
HUAWEI_OBS_SECRET_KEY=your-secret-key
HUAWEI_OBS_BUCKET=archmind-documents

# AI 模型
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx
GOOGLE_API_KEY=xxx
GLM_API_KEY=xxx
DASHSCOPE_API_KEY=xxx  # 通义千问
BAIDU_API_KEY=xxx      # 文心一言
DEEPSEEK_API_KEY=xxx
OLLAMA_BASE_URL=http://localhost:11434

# RAG 配置
EMBEDDING_MODEL=text-embedding-3-small
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K=5
SIMILARITY_THRESHOLD=0.7

# 默认值
DEFAULT_MODEL=glm-4
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=8000

# 安全
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-char-key
```

---

## 实现模式

### 1. API 路由

```typescript
// server/api/documents/index.get.ts
import { z } from 'zod'
import { documentDAO } from '~/lib/db/dao/document-dao'
import { requireAuth } from '~/server/utils/auth-helpers'

const QuerySchema = z.object({
  workspaceId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export default defineEventHandler(async (event) => {
  // 1. 验证输入
  const query = await getValidatedQuery(event, QuerySchema.parse)

  // 2. 检查权限（由全局中间件注入 userId，requireAuth 提取并抛出 401）
  const userId = requireAuth(event)

  // 3. 执行业务逻辑
  const result = await documentDAO.findByWorkspace(
    query.workspaceId,
    query.page,
    query.limit
  )

  // 4. 返回结果
  return { success: true, data: result }
})
```

### 2. 模型适配器

```typescript
// lib/ai/adapters/xxx-adapter.ts
export class XXXAdapter implements AIModelAdapter {
  readonly name = 'xxx-model'
  readonly provider = 'xxx'
  readonly maxTokens = 8000

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    // 实现生成逻辑
  }

  async *generateStream(prompt: string, options?: GenerateOptions): AsyncIterator<string> {
    // 实现流式生成
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // 返回估算成本 (USD)
  }
}
```

### 3. DAO 模式

```typescript
// lib/db/dao/document-dao.ts
export class DocumentDAO {
  async findById(id: string): Promise<Document | null> { ... }
  async findByWorkspace(workspaceId: string, page: number, limit: number): Promise<PaginatedResult<Document>> { ... }
  async create(data: CreateDocumentInput): Promise<Document> { ... }
  async update(id: string, data: UpdateDocumentInput): Promise<Document> { ... }
  async delete(id: string): Promise<void> { ... }
}

export const documentDAO = new DocumentDAO()
```

---

## 设计决策

### 本地优先架构

- 所有文档存储在本地 PostgreSQL
- 除 AI API 调用外无云存储
- 用户控制哪些文档发送给 AI
- 支持通过 Ollama 完全离线运行

### 多模型路由

基于任务类型自动选择最优模型：
- PRD 生成 → Claude 3.5 Sonnet
- 中文内容 → GLM-4 / 通义千问 / 文心一言
- 大文档 → Gemini 1.5 Pro (200K context)
- 隐私模式 → Ollama 本地模型

---

## shadcn/ui 使用指南

### 安装组件

```bash
# 基础组件
pnpm dlx shadcn-vue@latest add button input label textarea select checkbox

# 布局组件
pnpm dlx shadcn-vue@latest add card separator tabs scroll-area sidebar

# 反馈组件
pnpm dlx shadcn-vue@latest add dialog alert toast progress

# 数据组件
pnpm dlx shadcn-vue@latest add table badge avatar

# 导航组件
pnpm dlx shadcn-vue@latest add dropdown-menu navigation-menu breadcrumb
```

### 可用组件清单

实现自定义 UI 前检查：

| 类别 | 组件 |
|------|------|
| 布局 | Sidebar, NavigationMenu, Breadcrumb, Separator, ScrollArea |
| 表单 | Input, Label, Textarea, Select, Checkbox, RadioGroup, Switch |
| 反馈 | Dialog, Alert, Toast, Progress |
| 数据 | Table, Badge, Avatar, Card, Tabs |
| 操作 | Button, DropdownMenu |

**规则**: 如果 shadcn-vue 有该组件，**必须使用它**，不要自定义实现。

### 组件模式

```vue
<script setup lang="ts">
// 1. 导入
import { ref, computed } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

// 2. 类型定义
interface Props {
  title: string
  disabled?: boolean
}

// 3. Props
const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

// 4. 响应式状态
const isLoading = ref(false)

// 5. 计算属性
const buttonText = computed(() =>
  isLoading.value ? '处理中...' : '提交'
)

// 6. 方法
async function handleSubmit() {
  isLoading.value = true
  try {
    // ...
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold">{{ title }}</h2>
    <Button :disabled="disabled || isLoading" @click="handleSubmit">
      {{ buttonText }}
    </Button>
  </div>
</template>
```

---

## 文档导航

| 文档 | 描述 |
|------|------|
| [README.md](./README.md) | 项目主文档 |
| [CHANGELOG.md](./CHANGELOG.md) | 变更日志 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献指南 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 架构文档 |
| [docs/api/API.md](./docs/api/API.md) | API 参考 |

---

### 已知问题与改进计划

### 当前问题

1. **测试覆盖率低** (~15%) - 需要补充单元测试和集成测试
2. **缺少混合搜索实现** - RRF 融合算法待完善
3. **安全措施不足** - 缺少 CSRF、Rate Limiting
4. **性能优化欠缺** - 缺少缓存层、查询优化

### 已完成的改进（v0.1.1）

1. **认证安全** - 全局 JWT 认证中间件，所有 API 强制认证
2. **数据隔离** - 用户级 AI 配置隔离（`user_api_configs.user_id`）
3. **模型灵活性** - 用户可自选模型列表，支持 API 中转站（自定义 baseUrl）
4. **动态模型发现** - 验证 API 连接时自动获取真实可用模型

### 改进计划

详见 [CHANGELOG.md](./CHANGELOG.md) 的版本规划。

---

*最后更新: 2026-02-24*
