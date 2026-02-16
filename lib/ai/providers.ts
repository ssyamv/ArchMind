/**
 * AI 模型提供商定义
 * 定义所有支持的第三方 AI 模型提供商及其配置
 */

import type { AIProviderConfig, AIProviderType } from '~/types/settings'

export const AI_PROVIDERS: Record<AIProviderType, AIProviderConfig> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Claude 是 Anthropic 开发的 AI 助手，擅长复杂推理、长文本分析和代码生成。',
    website: 'https://console.anthropic.com/',
    authType: 'both',
    apiKeyPlaceholder: 'sk-ant-...',
    baseUrlPlaceholder: 'https://api.anthropic.com (官方) 或中转站地址',
    defaultBaseUrl: 'https://api.anthropic.com',
    supportsCustomUrl: true,
    models: [
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        description: '最新旗舰模型，最强推理能力，适合最复杂的任务',
        capabilities: {
          maxContextLength: 200000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$15 / 1M tokens',
          output: '$75 / 1M tokens'
        }
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        description: '最新平衡版本，高性能与成本兼顾',
        capabilities: {
          maxContextLength: 200000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$3 / 1M tokens',
          output: '$15 / 1M tokens'
        }
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: '上一代主力模型，性价比高',
        capabilities: {
          maxContextLength: 200000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$3 / 1M tokens',
          output: '$15 / 1M tokens'
        }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: '快速响应模型，适合简单任务和高并发场景',
        capabilities: {
          maxContextLength: 200000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$0.80 / 1M tokens',
          output: '$4 / 1M tokens'
        }
      }
    ]
  },

  openai: {
    id: 'openai',
    name: 'OpenAI (GPT)',
    description: 'OpenAI 的 GPT 系列模型，功能全面，生态丰富。',
    website: 'https://platform.openai.com/api-keys',
    authType: 'both',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.openai.com/v1 (官方) 或中转站地址',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportsCustomUrl: true,
    models: [
      {
        id: 'gpt-4.5-preview',
        name: 'GPT-4.5 Preview',
        description: '最新预览版模型，更强的推理和创作能力',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$75 / 1M tokens',
          output: '$150 / 1M tokens'
        }
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: '多模态旗舰模型，性能与成本平衡',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$2.50 / 1M tokens',
          output: '$10 / 1M tokens'
        }
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: '轻量级模型，快速响应，成本极低',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$0.15 / 1M tokens',
          output: '$0.60 / 1M tokens'
        }
      },
      {
        id: 'o1',
        name: 'o1',
        description: '深度推理模型，适合数学、编程和复杂分析',
        capabilities: {
          maxContextLength: 200000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$15 / 1M tokens',
          output: '$60 / 1M tokens'
        }
      },
      {
        id: 'o1-mini',
        name: 'o1 Mini',
        description: '轻量级推理模型，快速且经济',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$1.10 / 1M tokens',
          output: '$4.40 / 1M tokens'
        }
      },
      {
        id: 'o3-mini',
        name: 'o3 Mini',
        description: '最新推理模型，性价比更高',
        capabilities: {
          maxContextLength: 200000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$1.10 / 1M tokens',
          output: '$4.40 / 1M tokens'
        }
      }
    ]
  },

  google: {
    id: 'google',
    name: 'Google (Gemini)',
    description: 'Google 的 Gemini 模型，支持超大上下文窗口。',
    website: 'https://aistudio.google.com/app/apikey',
    authType: 'both',
    apiKeyPlaceholder: 'AIza...',
    baseUrlPlaceholder: 'https://generativelanguage.googleapis.com (官方) 或中转站地址',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    supportsCustomUrl: true,
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: '最新快速模型，响应迅速，支持多模态',
        capabilities: {
          maxContextLength: 1000000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$0.10 / 1M tokens',
          output: '$0.40 / 1M tokens'
        }
      },
      {
        id: 'gemini-2.0-pro',
        name: 'Gemini 2.0 Pro',
        description: '最新旗舰模型，最强性能',
        capabilities: {
          maxContextLength: 1000000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$1.25 / 1M tokens (≤128K)',
          output: '$5 / 1M tokens'
        }
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: '超大上下文 (1M tokens)，适合长文档处理',
        capabilities: {
          maxContextLength: 1000000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$1.25 / 1M tokens (≤128K)',
          output: '$5 / 1M tokens'
        }
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: '快速响应，适合高并发场景',
        capabilities: {
          maxContextLength: 1000000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$0.075 / 1M tokens',
          output: '$0.30 / 1M tokens'
        }
      }
    ]
  },

  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek 是中国开发的高性价比大模型，推理能力强，成本极低。',
    website: 'https://platform.deepseek.com/api_keys',
    authType: 'both',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.deepseek.com (官方) 或中转站地址',
    defaultBaseUrl: 'https://api.deepseek.com',
    supportsCustomUrl: true,
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek V3',
        description: '最新通用对话模型，适合日常对话和文本生成',
        capabilities: {
          maxContextLength: 64000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥0.5 / 1M tokens',
          output: '¥2 / 1M tokens'
        }
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek R1',
        description: '深度思考模型，适合复杂推理任务',
        capabilities: {
          maxContextLength: 64000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥4 / 1M tokens',
          output: '¥16 / 1M tokens'
        }
      }
    ]
  },

  qwen: {
    id: 'qwen',
    name: '阿里云通义千问',
    description: '阿里云开发的大语言模型，中文理解能力强。',
    website: 'https://dashscope.console.aliyun.com/apiKey',
    authType: 'api_key',
    apiKeyPlaceholder: 'sk-...',
    models: [
      {
        id: 'qwen-max',
        name: '通义千问 Max',
        description: '最强版本，适合复杂任务',
        capabilities: {
          maxContextLength: 30000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: true,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥20 / 1M tokens',
          output: '¥60 / 1M tokens'
        }
      },
      {
        id: 'qwen-plus',
        name: '通义千问 Plus',
        description: '平衡版本，性价比高',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: true,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥4 / 1M tokens',
          output: '¥12 / 1M tokens'
        }
      },
      {
        id: 'qwen-turbo',
        name: '通义千问 Turbo',
        description: '快速响应，成本最低',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: true,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥2 / 1M tokens',
          output: '¥6 / 1M tokens'
        }
      },
      {
        id: 'qwen-long',
        name: '通义千问 Long',
        description: '超长上下文，支持 1M tokens',
        capabilities: {
          maxContextLength: 1000000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥0.50 / 1M tokens',
          output: '¥2 / 1M tokens'
        }
      }
    ]
  },

  wenxin: {
    id: 'wenxin',
    name: '百度文心一言',
    description: '百度开发的大语言模型，中文深度理解能力强。',
    website: 'https://console.bce.baidu.com/qianfan/',
    authType: 'api_key',
    apiKeyPlaceholder: 'API Key|Secret Key',
    models: [
      {
        id: 'ernie-4.0-8k',
        name: 'ERNIE 4.0',
        description: '最新旗舰模型，综合能力最强',
        capabilities: {
          maxContextLength: 8000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥30 / 1M tokens',
          output: '¥60 / 1M tokens'
        }
      },
      {
        id: 'ernie-4.0-turbo-8k',
        name: 'ERNIE 4.0 Turbo',
        description: '加速版旗舰模型',
        capabilities: {
          maxContextLength: 8000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥12 / 1M tokens',
          output: '¥12 / 1M tokens'
        }
      },
      {
        id: 'ernie-3.5-8k',
        name: 'ERNIE 3.5',
        description: '高性价比版本',
        capabilities: {
          maxContextLength: 8000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥4 / 1M tokens',
          output: '¥8 / 1M tokens'
        }
      },
      {
        id: 'ernie-speed-8k',
        name: 'ERNIE Speed',
        description: '极速版，免费使用',
        capabilities: {
          maxContextLength: 8000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '免费',
          output: '免费'
        }
      }
    ]
  },

  glm: {
    id: 'glm',
    name: '智谱 ChatGLM',
    description: '智谱 AI 开发的国产大模型，支持长上下文，成本极低。',
    website: 'https://open.bigmodel.cn/api-keys',
    authType: 'api_key',
    apiKeyPlaceholder: '...',
    models: [
      {
        id: 'glm-4-plus',
        name: 'GLM-4 Plus',
        description: '最新旗舰模型，综合能力最强',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥50 / 1M tokens',
          output: '¥50 / 1M tokens'
        }
      },
      {
        id: 'glm-4-air',
        name: 'GLM-4 Air',
        description: '平衡版本，性价比高',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥1 / 1M tokens',
          output: '¥1 / 1M tokens'
        }
      },
      {
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        description: '快速版本，免费使用',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '免费',
          output: '免费'
        }
      },
      {
        id: 'glm-4v-plus',
        name: 'GLM-4V Plus',
        description: '多模态模型，支持图像理解',
        capabilities: {
          maxContextLength: 8000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥10 / 1M tokens',
          output: '¥10 / 1M tokens'
        }
      }
    ]
  },

  ollama: {
    id: 'ollama',
    name: 'Ollama (本地)',
    description: '在本地运行开源大模型，完全离线，无隐私风险。',
    website: 'https://ollama.ai',
    authType: 'base_url',
    baseUrlPlaceholder: 'http://localhost:11434',
    defaultBaseUrl: 'http://localhost:11434',
    models: [
      {
        id: 'llama3.3',
        name: 'Llama 3.3 70B',
        description: 'Meta 最新开源模型，70B 参数版本',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['en']
        },
        costEstimate: {
          input: '本地免费',
          output: '本地免费'
        }
      },
      {
        id: 'llama3.2',
        name: 'Llama 3.2',
        description: 'Meta 轻量级模型，适合日常使用',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: true,
          supportedLanguages: ['en']
        },
        costEstimate: {
          input: '本地免费',
          output: '本地免费'
        }
      },
      {
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        description: '通义千问开源版本，中文支持好',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '本地免费',
          output: '本地免费'
        }
      },
      {
        id: 'deepseek-r1',
        name: 'DeepSeek R1',
        description: 'DeepSeek 推理模型本地版',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '本地免费',
          output: '本地免费'
        }
      },
      {
        id: 'gemma3',
        name: 'Gemma 3',
        description: 'Google 开源轻量模型',
        capabilities: {
          maxContextLength: 32000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: true,
          supportedLanguages: ['en']
        },
        costEstimate: {
          input: '本地免费',
          output: '本地免费'
        }
      },
      {
        id: 'mistral',
        name: 'Mistral',
        description: 'Mistral AI 高效开源模型',
        capabilities: {
          maxContextLength: 32000,
          supportsStreaming: true,
          supportsStructuredOutput: false,
          supportsVision: false,
          supportedLanguages: ['en']
        },
        costEstimate: {
          input: '本地免费',
          output: '本地免费'
        }
      }
    ]
  },

  custom: {
    id: 'custom',
    name: '自定义 API',
    description: '配置自定义的第三方 API 中转站或兼容接口。',
    website: '',
    authType: 'both',
    apiKeyPlaceholder: 'API Key（可选）',
    baseUrlPlaceholder: 'https://your-api-proxy.com/v1',
    defaultBaseUrl: '',
    supportsCustomUrl: true,
    models: []
  }
}

/**
 * 获取所有提供商列表
 */
export function getAllProviders(): AIProviderConfig[] {
  return Object.values(AI_PROVIDERS)
}

/**
 * 获取指定提供商的配置
 */
export function getProviderConfig(providerId: AIProviderType): AIProviderConfig | null {
  return AI_PROVIDERS[providerId] || null
}

/**
 * 根据模型 ID 查找提供商
 */
export function findProviderByModelId(modelId: string): AIProviderConfig | null {
  for (const provider of Object.values(AI_PROVIDERS)) {
    if (provider.models.some(m => m.id === modelId)) {
      return provider
    }
  }
  return null
}
