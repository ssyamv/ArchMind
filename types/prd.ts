/**
 * PRD 类型定义
 */

export interface PRDDocument {
  id: string;
  userId?: string;
  workspaceId?: string;
  parentId?: string;
  title: string;
  userInput: string;
  content: string;
  modelUsed: string;
  generationTime?: number;
  tokenCount?: number;
  estimatedCost?: number;
  status?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PRDDocumentReference {
  id: string;
  prdId: string;
  documentId: string;
  relevanceScore?: number;
}

export interface PRDGenerateRequest {
  userInput: string;
  model?: string;
  modelId?: string;  // 新增：指定使用的模型 ID（如 "glm-4-flash"）
  temperature?: number;
  maxTokens?: number;
  useRAG?: boolean;
  documentIds?: string[];
  workspaceId?: string;
  parentId?: string;  // 指定该次生成为某 PRD 的新版本
  templateId?: string;  // #67 PRD 模板 ID，默认 'standard'
}

export interface PRDGenerateResponse {
  success: boolean;
  data: {
    id: string;
    content: string;
    model: string;
    tokenCount: number;
    estimatedCost: number;
    generationTime: number;
  };
}

export interface PRDStreamChunk {
  chunk?: string;
  done?: boolean;
  error?: string;
}
