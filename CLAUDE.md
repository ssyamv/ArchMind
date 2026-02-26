# CLAUDE.md

> AI 开发助手指南 - Claude Code 专用项目配置

---

## 项目概述

**ArchMind AI** 是一个本地运行的 MVP 工具，通过 RAG（检索增强生成）技术将历史文档转化为产品需求文档（PRD）和原型。

**核心价值**: 让每一份历史文档都成为新功能的基础，消除产品迭代中的逻辑断层。

### 项目状态

| 指标 | 状态 |
|------|------|
| 版本 | 0.2.1 |
| 框架 | Nuxt 3.21 + Vue 3.5 + TypeScript 5.9 |
| 数据库 | PostgreSQL 14+ + pgvector |
| 组件 | 181 个 (30+ shadcn/ui) |
| API 端点 | 111 个 |
| 测试覆盖率 | ~89% (292+ 个测试用例) |

---

## 关键规则

### 0. Git 工作流规范（最高优先级）

#### 0.1 提交确认流程

**在执行任何 `git push` 或提交操作之前，必须先向用户展示将要提交的内容并获得明确确认。**

| 步骤 | 说明 |
|------|------|
| 1. 展示变更 | 运行 `git status` 和 `git diff --stat`，向用户展示将要提交的文件列表 |
| 2. 草拟提交信息 | 写出 commit message 供用户审阅 |
| 3. 等待确认 | **停止操作**，等待用户明确说"可以"、"提交"、"确认"等指令 |
| 4. 执行提交 | 用户确认后，才执行 `git add` + `git commit` + `git push` |

**禁止**在用户未确认的情况下直接 push 代码到任何远程分支。

#### 0.1.1 PR 合并前置检查规则（强制执行）

> ⚠️ **此规则因违反一次而特别强调，必须严格遵守**

**合并任何 PR 前，必须确认所有 CI 校验全部通过（绿色），才允许执行合并操作。**

| 禁止行为 | 说明 |
|----------|------|
| ❌ CI 失败的 PR 直接合并 | 即使只是 Lint/TypeCheck 失败，也不允许合并 |
| ❌ 使用 `--admin` 绕过 Branch Protection | 禁止用管理员权限强制合并未通过 CI 的 PR |
| ❌ 合并前不检查 CI 状态 | 每次合并前必须运行 `gh pr checks <PR号>` 确认全部通过 |

**合并 PR 的正确流程**：

```bash
# 1. 检查 CI 状态，确保全部通过
gh pr checks <PR号>

# 2. 确认所有 check 均为 pass（不含 fail/skipping 关键步骤）
# 如有 fail，先在对应分支修复，再重新触发 CI

# 3. CI 全部通过后，才执行合并
gh pr merge <PR号> --merge
```

**如遇 CI 失败，必须**：
1. 查看失败日志（`gh run view <run-id> --log-failed`）
2. 在功能分支上修复问题
3. 推送修复，等待新的 CI 通过
4. CI 全通过后再合并

#### 0.2 分支策略（Git Flow）

```
main          ← 生产分支，永远保持可发布状态，只接受 PR 合并
develop       ← 集成分支，功能开发完毕后合并至此
feature/*     ← 功能分支，从 develop 切出，完成后 PR 到 develop
fix/*         ← 修复分支，从 develop 切出（hotfix 从 main 切出）
release/*     ← 发布分支，从 develop 切出，测试通过后合并到 main + develop
```

**禁止**直接向 `main` 分支提交代码（GitHub Branch Protection 已强制执行）。

#### 0.2.1 Claude Code 默认行为规则

**除非用户明确说"直接提交到 main"或"直接 push 到 main"，否则 Claude Code 必须：**

1. 在功能分支（`feature/*` 或 `fix/*`）上进行所有代码修改
2. 完成后 push 功能分支到远程
3. 创建 PR（提供 PR 描述供用户在 GitHub 上合并）

**禁止**在未获得用户明确授权的情况下直接操作 `main` 分支。

#### 0.2.2 版本功能合并规则（严格执行）

> ⚠️ **此规则因违反一次而特别强调，必须严格遵守**

**整个版本（如 v0.2.0）的所有功能开发完毕后，才能合并到 `main` 分支，且合并前必须获得用户的明确同意。**

| 禁止行为 | 说明 |
|----------|------|
| ❌ 单个功能完成就合并到 main | 即使 CI 全通过，也不允许 |
| ❌ 用户不在场时自行合并到 main | 即使用户说"你自己安排"，也不允许合并到 main |
| ❌ 合并 PR 到 main 不等待确认 | 任何涉及 main 分支的合并都需用户明确说"合并"、"可以合并到 main" |

**正确流程**：

```
feature/* → develop（每个功能完成后可合并到 develop）
develop   → main（整个版本全部完成后，由用户明确授权后才能合并）
```

即：**功能分支 PR 目标是 `develop`，不是 `main`**。只有 `release/*` 分支才合并到 `main`，且必须用户确认。

#### 0.3 标准开发流程

```bash
# 1. 从 develop 切出功能分支
git checkout develop && git pull origin develop
git checkout -b feature/xxx-description

# 2. 开发、提交（遵循 Conventional Commits 规范）
git add <具体文件>
git commit -m "feat: add xxx"

# 3. push 功能分支（非 main，无需本地 CI 验证）
git push origin feature/xxx-description

# 4. 在 GitHub 创建 PR: feature/xxx → develop
# 5. 合并到 develop 后，由 release 流程合并到 main
```

#### 0.4 Commit Message 规范（Conventional Commits）

| 类型 | 场景 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | Bug 修复 |
| `docs:` | 文档变更 |
| `refactor:` | 重构（不含新功能/修复） |
| `test:` | 测试相关 |
| `chore:` | 构建/工具链/依赖变更 |
| `ci:` | CI/CD 配置变更 |
| `perf:` | 性能优化 |

**示例**: `feat: add AlertDialog for delete confirmation in profile page`

#### 0.5 版本发布流程

```bash
# 1. 从 develop 切出 release 分支
git checkout -b release/vX.Y.Z develop

# 2. 更新 package.json 版本号、CHANGELOG.md

# 3. 合并到 main 并打 tag
git checkout main && git merge --no-ff release/vX.Y.Z
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main --tags

# 4. 同步回 develop
git checkout develop && git merge --no-ff release/vX.Y.Z
git push origin develop

# 5. 删除 release 分支
git branch -d release/vX.Y.Z
```

---

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
| ❌ 禁止 | `window.alert()`、`window.confirm()`、`window.prompt()` 等浏览器原生弹窗 |
| ✅ 样式 | 仅使用 Tailwind CSS |
| ✅ 条件类 | 使用 `cn()` 工具函数 |

**浏览器原生弹窗替代方案**:

| 原生 API | shadcn/ui 替代 |
|----------|---------------|
| `alert()` / 错误提示 | `useToast()` from `~/components/ui/toast/use-toast` |
| `confirm()` / 危险操作二次确认 | `AlertDialog` from `~/components/ui/alert-dialog` |
| `prompt()` / 输入弹窗 | `Dialog` + `Input` from `~/components/ui/dialog` |

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
│   ├── api/                 # API 路由（111 个文件）
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

### 文件位置

| 文件 | 用途 | 是否提交 git |
|------|------|------------|
| `.env` | 本地开发环境变量 | ❌ gitignored |
| `.env.example` | 变量模板（无真实值）| ✅ 已提交 |
| `.vercel/.env.development.local` | `vercel env pull` 自动生成，含线上变量 | ❌ gitignored |
| `.vercel/.env.production.local` | 手动维护的线上完整配置（含 DB、密钥等）| ❌ gitignored |

> **线上环境变量统一放在 `.vercel/` 目录**，本地开发只需修改根目录的 `.env`。

### 变量清单

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

1. **缺少 CSRF Token 前端注入** - 当前 CSRF 采用 Origin/Referer 校验，未实现 Token 模式
2. **Redis 缓存为可选** - 未配置 `REDIS_URL` 时降级为内存缓存，重启后失效
3. **`document_embeddings` 表需手动迁移** - 生产环境需执行 `pnpm db:migrate-multi-model`

### 已完成的改进（v0.2.0）

1. **测试覆盖率** - 从 15% 提升至 89%，核心模块（lib/rag、lib/prd、lib/db）覆盖率超 80%
2. **混合搜索 RRF** - 默认启用 RRF 混合检索，支持参数配置与质量评估
3. **安全加固** - Rate Limiting + CSRF 保护中间件，管理员也无法绕过 CI 合并
4. **性能优化** - Redis 缓存层（降级内存），Sentry 全链路监控
5. **API 版本化** - 所有路由迁移至 `/api/v1/`
6. **功能扩展** - PRD 导出 PDF/Word、对话历史搜索、SSE 实时进度、工作区成员邀请
7. **Vercel 生产修复** - 临时目录路径、stats 500、SSL 警告

### 改进计划

详见 [CHANGELOG.md](./CHANGELOG.md) 的版本规划。

---

*最后更新: 2026-02-26*
