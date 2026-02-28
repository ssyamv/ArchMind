/**
 * 设置相关类型定义
 */

export interface AIModelSettings {
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface RAGSettings {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  embeddingModel: string;
}

export interface SystemSettings {
  aiModel: AIModelSettings;
  rag: RAGSettings;
  [key: string]: any;
}

export interface SettingsResponse {
  success: boolean;
  data?: SystemSettings;
  message?: string;
}

// 可用的模型信息（从后端返回给前端）
export interface AvailableModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  isUserModel?: boolean;
  capabilities: {
    maxContextLength: number;
    supportsStreaming: boolean;
    supportsStructuredOutput: boolean;
    supportsVision: boolean;
    supportedLanguages: string[];
  };
  costEstimate: {
    input: string;
    output: string;
  };
  embedding?: {
    supported: boolean;
    provider?: string;
    model?: string;
    dimensions?: number;
  };
}

// 模型列表 API 响应
export interface AvailableModelsResponse {
  success: boolean;
  data: {
    availableModels: AvailableModelInfo[];
    defaultModel: string;
    selectedModel?: string;
  };
  message?: string;
}

// ============================================
// AI 模型提供商配置相关类型
// ============================================

export type AIProviderType =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'wenxin'
  | 'glm'
  | 'ollama'
  | 'custom'  // 自定义第三方 API

// 图片生成提供商类型 (独立于文本模型)
export type ImageProviderType = 'wanx' | 'dall-e' | 'stability'

// 自定义 API 配置（用于第三方中转站）
export interface CustomAPIConfig {
  id: string  // 唯一标识，如 "custom-openai-proxy"
  name: string  // 用户自定义名称
  baseUrl: string  // API 地址
  apiKey?: string  // API Key（可选，有些中转站不需要）
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AIProviderConfig {
  id: AIProviderType
  name: string
  description: string
  website: string
  authType: 'api_key' | 'base_url' | 'both'
  apiKeyPlaceholder?: string
  baseUrlPlaceholder?: string
  defaultBaseUrl?: string
  supportsCustomUrl?: boolean  // 是否支持自定义 Base URL（中转站）
  models: AIModelDefinition[]
}

export interface AIModelDefinition {
  id: string
  name: string
  description: string
  capabilities: {
    maxContextLength: number
    supportsStreaming: boolean
    supportsStructuredOutput: boolean
    supportsVision: boolean
    supportedLanguages: string[]
  }
  costEstimate: {
    input: string
    output: string
  }
}

// 图片生成提供商配置
export interface ImageProviderConfig {
  id: ImageProviderType
  name: string
  description: string
  website: string
  authType: 'api_key'
  apiKeyPlaceholder?: string
  models: ImageModelDefinition[]
}

export interface ImageModelDefinition {
  id: string
  name: string
  description: string
  capabilities: {
    maxResolution: string
    supportedSizes: string[]
    supportsEdit: boolean
    supportsInpaint: boolean
  }
  costEstimate: {
    perImage: string
  }
}

// 用户保存的 API 配置（存储到数据库）
export interface UserAPIConfig {
  provider: AIProviderType
  apiKey?: string  // 加密存储
  baseUrl?: string
  models?: string[]  // 用户自定义的模型 ID 列表
  enabled: boolean
  createdAt: string
  updatedAt: string
}

// API 配置请求/响应类型
export interface SaveAPIConfigRequest {
  provider: AIProviderType
  apiKey?: string
  baseUrl?: string
  models?: string[]  // 用户选择的模型 ID 列表
  enabled?: boolean
}

export interface APIConfigResponse {
  success: boolean
  data?: UserAPIConfig
  message?: string
}

export interface AllAPIConfigsResponse {
  success: boolean
  data?: UserAPIConfig[]
  message?: string
}

// 验证 API 连接请求
export interface ValidateAPIRequest {
  provider: AIProviderType
  apiKey?: string
  baseUrl?: string
}

export interface ValidateAPIResponse {
  success: boolean
  message?: string
  availableModels?: string[]
  modelsFetched?: boolean  // 是否为动态获取的真实列表
}

