# Vision in Chat - 对话识图功能

> 功能分支：`feature/vision-in-chat`
> 关联 Issue：待创建
> 状态：开发中

---

## 1. 功能需求

### 1.1 用户故事

作为产品经理，我希望在与 AI 对话时，能够上传一张 UI 截图或参考设计图，让 AI 理解图片中的视觉风格、布局结构和设计要素，并参考这些内容来生成符合期望风格的 PRD 或原型。

### 1.2 核心使用场景

| 场景 | 描述 | 期望输出 |
|------|------|----------|
| **参考风格** | 上传竞品截图 + "参考这个风格设计我们的首页 PRD" | 风格描述融入 PRD 中 |
| **修改优化** | 截图当前页面 + "保持这个布局，加上用户反馈模块" | 基于现有布局的增量 PRD |
| **线框分析** | 上传低保真草图 + "帮我把这个线框图完善成完整 PRD" | 完整 PRD 文档 |
| **竞品分析** | 上传竞品功能截图 + "分析这个功能的关键点" | 竞品功能分析 |

### 1.3 功能边界

- **支持格式**：PNG、JPEG、WebP、GIF
- **单图大小**：≤ 5MB
- **每条消息**：最多 5 张图
- **不支持模型**：DeepSeek、文心一言 → UI 明确提示用户切换至支持 vision 的模型
- **历史消息**：带图片的历史消息在本次对话中保留图片上下文（完整多轮）

---

## 2. 技术设计

### 2.1 架构现状分析

探索代码库后，发现**基础架构已基本实现**，但存在关键数据流断裂：

```
已实现 ✅：
├── types/conversation.ts          → ImageAttachment 类型、ConversationMessage.images 字段
├── components/chat/ImageUpload.vue → 文件选择、Base64 转换、预览
├── components/chat/MessageInput.vue → 集成 ImageUpload，emit 包含 images
├── components/chat/MessageBubble.vue → 显示用户消息中的图片
├── server/api/v1/chat/stream.post.ts → 接收 images 参数并传递给引擎
├── lib/chat/engine.ts              → buildMessages() 支持多模态 ContentBlock
└── AI 适配器 (Claude/OpenAI/Gemini/GLM/Qwen) → 均已支持 vision

数据流断裂 ❌：
├── pages/generate.vue: handleSendMessage 类型定义缺少 images 参数
├── pages/generate.vue: addUserMessage 调用未传递 images
├── pages/generate.vue: API 请求 body 未包含 images
├── pages/generate.vue: history 映射未包含 messages 中的 images
└── composables/useConversation.ts: addUserMessage 参数类型缺少 images
```

### 2.2 完整数据流

```
用户选择图片
    │
    ▼
ImageUpload.vue
├── FileReader.readAsDataURL()
├── 提取 base64 数据（去除 data:image/...;base64, 前缀）
└── 创建 ImageAttachment { id, type:'base64', data, mimeType, name, size }
    │
    ▼
MessageInput.vue
├── 显示缩略图预览
└── emit('send', message, { ..., images: ImageAttachment[] })
    │
    ▼
pages/generate.vue → handleSendMessage(message, { images, ... })
├── addUserMessage(message, { images, ... })  → conversation.messages 保存图片
├── API body 包含 images
└── history 映射包含各消息的 images
    │
    ▼
POST /api/v1/chat/stream
{ message, history:[{...,images}], images, modelId, ... }
    │
    ▼
lib/chat/engine.ts → buildMessages()
├── 历史消息：带图片 → ContentBlock[]（text + image blocks）
└── 当前消息：带图片 → ContentBlock[]
    │
    ▼
AI 适配器 (Claude / OpenAI / Gemini / ...)
├── Claude:  { type:'image', source:{ type:'base64', media_type, data } }
├── OpenAI:  { type:'image_url', image_url:{ url:'data:image/...;base64,...' } }
└── Gemini:  { inlineData:{ mimeType, data } }
    │
    ▼
AI 模型处理图片 → 流式文本响应
    │
    ▼
SSE 流 → 前端实时显示
```

### 2.3 模型视觉能力矩阵

| 模型 | 支持识图 | 图片格式 | 备注 |
|------|---------|----------|------|
| Claude 3.5 Sonnet | ✅ | Base64 + URL | 推荐用于风格分析 |
| GPT-4o | ✅ | Base64 + URL | 推荐 |
| Gemini 1.5 Pro | ✅ | 仅 Base64 | 大上下文，适合多图 |
| GLM-4.6V | ✅ | Base64 + URL | 需选择带 V 的视觉模型 |
| 通义千问 VL | ✅ | OpenAI 兼容 | 中文场景推荐 |
| DeepSeek Chat | ❌ | — | 无 vision 能力，需提示用户 |
| 文心一言 | ❌ | — | 无 vision 能力，需提示用户 |
| Ollama (llava/vision) | ⚠️ | Base64 | 根据模型名动态判断 |

---

## 3. 实现计划

### 3.1 Bug 修复（核心路径打通）

**文件**：`composables/useConversation.ts`
- `addUserMessage` 参数类型添加 `images?: ImageAttachment[]`
- 创建消息时赋值 `images`

**文件**：`pages/generate.vue`
- `handleSendMessage` 类型签名添加 `images?: ImageAttachment[]`
- `addUserMessage` 调用传递 `images`
- API 请求 body 添加 `images` 字段
- `history` 映射包含各消息的 `images`

### 3.2 新增：模型视觉能力检测与提示

**文件**：`lib/ai/types.ts`
- `AIModelAdapter` 接口已有 `supportsVision: boolean` → 确认无需修改

**文件**：`components/chat/MessageInput.vue`
- 当选中模型不支持 vision 且用户已上传图片时，显示 Warning Badge
- 提示文案："当前模型不支持识图，请切换至 GPT-4o、Claude 或 Gemini"

### 3.3 UI 改进（可选）

- 支持 Ctrl+V 粘贴截图（`paste` 事件处理）
- 图片上传区域支持拖拽
- 图片上传后显示文件名和大小
- 上传中显示进度指示

---

## 4. 验收标准

- [ ] 用户可在对话框上传 PNG/JPEG/WebP 图片
- [ ] 图片以缩略图形式显示在输入区，支持删除
- [ ] 发送带图片的消息后，消息气泡显示图片预览
- [ ] AI 能识别图片内容并在回复中引用
- [ ] 历史消息中的图片在多轮对话中保持上下文
- [ ] 不支持识图的模型选中时，上传图片后显示警告
- [ ] 支持 Ctrl+V 粘贴截图

---

*创建时间：2026-03-02*
