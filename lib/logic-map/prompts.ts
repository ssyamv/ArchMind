/**
 * Mermaid 逻辑图谱生成 System Prompts
 *
 * 支持 4 种图形类型：flowchart / sequence / state / class
 */

export type LogicMapType = 'flowchart' | 'sequence' | 'state' | 'class'

const FLOWCHART_FEW_SHOT = `
以下是流程图的示例输出格式：

\`\`\`mermaid
flowchart TD
  A([用户访问登录页]) --> B[输入邮箱和密码]
  B --> C{格式校验}
  C -->|校验失败| D[显示表单错误]
  D --> B
  C -->|校验通过| E[POST /api/auth/login]
  E --> F{服务器验证}
  F -->|密码错误| G[显示错误提示\\n剩余尝试次数-1]
  G --> H{超过5次?}
  H -->|是| I[锁定账号15分钟]
  H -->|否| B
  F -->|成功| J[颁发 JWT Token]
  J --> K[写入 HttpOnly Cookie]
  K --> L([跳转到工作区首页])
\`\`\`
`

const SEQUENCE_FEW_SHOT = `
以下是时序图的示例输出格式：

\`\`\`mermaid
sequenceDiagram
  participant U as 用户
  participant F as 前端
  participant A as API 服务
  participant D as 数据库

  U->>F: 提交登录表单
  F->>F: 本地格式校验
  F->>A: POST /api/v1/auth/login
  A->>D: 查询用户记录
  D-->>A: 返回用户信息
  A->>A: 验证密码哈希
  alt 验证成功
    A-->>F: 200 { token }
    F->>F: 存储 Token
    F-->>U: 跳转到工作区
  else 验证失败
    A-->>F: 401 { message }
    F-->>U: 显示错误提示
  end
\`\`\`
`

const STATE_FEW_SHOT = `
以下是状态图的示例输出格式：

\`\`\`mermaid
stateDiagram-v2
  [*] --> 草稿 : 用户创建 PRD
  草稿 --> 生成中 : 提交生成请求
  生成中 --> 已完成 : AI 生成成功
  生成中 --> 失败 : AI 生成超时或错误
  失败 --> 生成中 : 用户重试
  已完成 --> 归档 : 用户归档
  归档 --> [*]
  已完成 --> [*] : 用户删除
  草稿 --> [*] : 用户删除
\`\`\`
`

const CLASS_FEW_SHOT = `
以下是类图的示例输出格式：

\`\`\`mermaid
classDiagram
  class Workspace {
    +UUID id
    +String name
    +String description
    +createDocument()
    +inviteMember()
  }
  class User {
    +UUID id
    +String email
    +String passwordHash
    +login()
    +updateProfile()
  }
  class WorkspaceMember {
    +UUID workspaceId
    +UUID userId
    +String role
    +getPermissions()
  }
  Workspace "1" --> "*" WorkspaceMember : 包含
  User "1" --> "*" WorkspaceMember : 属于
\`\`\`
`

const FEW_SHOTS: Record<LogicMapType, string> = {
  flowchart: FLOWCHART_FEW_SHOT,
  sequence: SEQUENCE_FEW_SHOT,
  state: STATE_FEW_SHOT,
  class: CLASS_FEW_SHOT,
}

const TYPE_INSTRUCTIONS: Record<LogicMapType, string> = {
  flowchart: `生成**流程图（Flowchart）**，使用 \`flowchart TD\` 语法。
要求：
1. 必须包含正常流程和异常分支（Error Path）
2. 节���命名使用动词短语（如"验证密码"、"发送通知"）
3. 使用 ([...]) 表示开始/结束，{...} 表示判断，[...] 表示步骤
4. 条件分支必须标注判断条件（如 |成功| |失败|）`,

  sequence: `生成**时序图（Sequence Diagram）**，使用 \`sequenceDiagram\` 语法。
要求：
1. 标注系统边界（Internal/External），命名清晰的参与者
2. 消息命名使用 API 路径格式（如 POST /api/v1/xxx）
3. 使用 alt/else 处理成功/失败分支
4. 异步消息使用 ->> 和 -->>`,

  state: `生成**状态图（State Diagram）**，使用 \`stateDiagram-v2\` 语法。
要求：
1. 每个状态必须有明确的进入条件和退出条件
2. 初始状态使用 [*]，终态也必须标注 [*]
3. 状态名称简洁，转换标注触发事件
4. 覆盖所有业务状态，不遗漏中间状态`,

  class: `生成**类图（Class Diagram）**，使用 \`classDiagram\` 语法。
要求：
1. 包含主要属性（类型 + 名称）和关键方法
2. 使用 +（public）- （private）# （protected）标注可见性
3. 明确标注类间关系（继承、组合、关联）及多重性
4. 重点关注核心实体，不要过度细化`,
}

/**
 * 构建逻辑图生成的 System Prompt
 */
export function buildLogicMapSystemPrompt (type: LogicMapType): string {
  return `你是一个专业的产品架构专家，擅长分析 PRD 文档并生成清晰的可视化图形。

## 任务

${TYPE_INSTRUCTIONS[type]}

## 输出要求

1. **只输出 Mermaid 代码块**，格式为：
\`\`\`mermaid
[你的 Mermaid 代码]
\`\`\`

2. **不要在代码块外添加任何解释文字**（代码块外的所有文字都会被忽略）
3. 代码必须是语法正确的 Mermaid，能被 mermaid.js v11 解析
4. 中文节点名称可以直接使用，无需加引号

## 参考示例

${FEW_SHOTS[type]}

## 重要规则

- 严格基于 PRD 内容生成，不要添加 PRD 中未提及的功能
- 如果 PRD 内容不足以生成完整图形，基于合理假设补充必要节点，但保持简洁
- 图形节点总数控制在 5-20 个之间，过多会降低可读性`
}

/**
 * 构建用户 Prompt（包含 PRD 内容）
 */
export function buildLogicMapUserPrompt (
  prdContent: string,
  type: LogicMapType,
  focus?: string
): string {
  const focusNote = focus ? `\n\n**重点关注**：${focus}（只分析与此相关的部分）` : ''

  return `请基于以下 PRD 内容，生成${getTypeName(type)}。${focusNote}

---
${prdContent.slice(0, 6000)}${prdContent.length > 6000 ? '\n[...内容已截断...]' : ''}
---`
}

function getTypeName (type: LogicMapType): string {
  const names: Record<LogicMapType, string> = {
    flowchart: '流程图',
    sequence: '时序图',
    state: '状态图',
    class: '类图',
  }
  return names[type]
}

/**
 * 从 AI 流式输出中提取 Mermaid 代码
 */
export function extractMermaidCode (rawOutput: string): string | null {
  const match = rawOutput.match(/```mermaid\n([\s\S]*?)```/)
  return match?.[1]?.trim() ?? null
}
