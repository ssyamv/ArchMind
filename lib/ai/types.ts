export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  messages?: ChatMessage[];
}

export interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  maxContextLength: number;
  supportedLanguages: string[];
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  currency: string;
}

export interface AIModelAdapter {
  name: string;
  provider: string;
  modelId: string;

  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  generateStream(prompt: string, options?: GenerateOptions): AsyncGenerator<string>;

  getCapabilities(): ModelCapabilities;
  estimateCost(tokens: number): CostEstimate;
  isAvailable(): Promise<boolean>;
}

export enum TaskType {
  PRD_GENERATION = 'prd_generation',
  CHINESE_CONTENT = 'chinese_content',
  LARGE_DOCUMENT = 'large_document',
  COST_SENSITIVE = 'cost_sensitive',
  PRIVACY_MODE = 'privacy_mode',
}
