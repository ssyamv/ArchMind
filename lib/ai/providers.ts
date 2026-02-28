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
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        description: '最新旗舰，14.5h 任务时间地平线，适合最复杂的长程 Agent 任务（2026年2月）',
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
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        description: '最新平衡版，接近 Opus 4.6 的编码能力，1/5 的价格，ARC-AGI-2 提升 4.3x（2026年2月）',
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
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        description: 'Agent 和编码特化，上一代主力，性价比高（2025年9月）',
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
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        description: '最快轻量模型，适合高并发、低延迟场景',
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
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        description: '编码专项优化，指令遵循更精准，100 万 tokens 上下文，支持微调',
        capabilities: {
          maxContextLength: 1000000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$2 / 1M tokens',
          output: '$8 / 1M tokens'
        }
      },
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
        description: 'GPT-4.1 轻量版，成本更低，同样支持 100 万 tokens 上下文',
        capabilities: {
          maxContextLength: 1000000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$0.40 / 1M tokens',
          output: '$1.60 / 1M tokens'
        }
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: '多模态旗舰，图像理解能力强，性能与成本均衡',
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
        description: '轻量级多模态，快速响应，成本极低',
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
        id: 'o3',
        name: 'o3',
        description: '最强推理模型，编程/数学/科学 SOTA，支持工具调用和视觉',
        capabilities: {
          maxContextLength: 200000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$10 / 1M tokens',
          output: '$40 / 1M tokens'
        }
      },
      {
        id: 'o4-mini',
        name: 'o4-mini',
        description: '快速低成本推理，AIME 表现最佳，支持工具调用',
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
      },
      {
        id: 'o3-mini',
        name: 'o3 Mini',
        description: '性价比推理模型，数学和编码表现优秀',
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
    description: 'Google 的 Gemini 模型，支持超大上下文窗口和思维推理能力。',
    website: 'https://aistudio.google.com/app/apikey',
    authType: 'both',
    apiKeyPlaceholder: 'AIza...',
    baseUrlPlaceholder: 'https://generativelanguage.googleapis.com (官方) 或中转站地址',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    supportsCustomUrl: true,
    models: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: '最新思维旗舰，100 万 tokens 上下文，Deep Think 增强推理，编码/数学 SOTA（2025年3月）',
        capabilities: {
          maxContextLength: 1000000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en', 'ja', 'es', 'fr', 'de']
        },
        costEstimate: {
          input: '$1.25 / 1M tokens (≤200K)',
          output: '$10 / 1M tokens'
        }
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: '快速思维模型，低延迟低成本，兼顾推理，1M tokens 上下文',
        capabilities: {
          maxContextLength: 1000000,
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
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: '稳定快速多模态，1M tokens 上下文，适合高并发场景',
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
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: '超大上下文 (1M tokens)，适合超长文档处理，稳定版本',
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
        name: 'DeepSeek V3.2',
        description: '最新通用模型，首个将思考集成到工具调用的模型，1800+ 环境 Agent 训练（2025年12月）',
        capabilities: {
          maxContextLength: 128000,
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
        description: '深度思考推理模型，适合数学/科学/代码复杂逻辑分析',
        capabilities: {
          maxContextLength: 128000,
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
    description: '阿里云开发的大语言模型，中文理解能力强，Qwen3.5 系列媲美 GPT-5.2。',
    website: 'https://dashscope.console.aliyun.com/apiKey',
    authType: 'api_key',
    apiKeyPlaceholder: 'sk-...',
    models: [
      {
        id: 'qwen3.5-plus',
        name: 'Qwen3.5-Plus',
        description: '最新旗舰，397B MoE/17B激活，原生多模态（文字+图像+视频），媲美 GPT-5.2（2026年2月）',
        capabilities: {
          maxContextLength: 131072,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥24 / 1M tokens',
          output: '¥72 / 1M tokens'
        }
      },
      {
        id: 'qwen3-max',
        name: 'Qwen3-Max',
        description: '千问3系旗舰，原生 search/code agent，思考与非思考模式，性能超越 Qwen3.5-Plus 前代',
        capabilities: {
          maxContextLength: 131072,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥24 / 1M tokens',
          output: '¥72 / 1M tokens'
        }
      },
      {
        id: 'qwen-long',
        name: '通义千问 Long',
        description: '超长上下文，支持 1M tokens，适合超大文档处理',
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
    name: '智谱 GLM',
    description: '智谱 AI 开发的国产大模型，GLM-4.7 编码能力媲美 Claude Sonnet 4.5，成本极低。',
    website: 'https://open.bigmodel.cn/api-keys',
    authType: 'api_key',
    apiKeyPlaceholder: '...',
    models: [
      {
        id: 'glm-4.7',
        name: 'GLM-4.7',
        description: '旗舰推理模型，355B MoE，200K 上下文，SWE-bench 开源第一，支持思考模式（2025年12月）',
        capabilities: {
          maxContextLength: 200000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥0.1 / 1M tokens',
          output: '¥0.1 / 1M tokens'
        }
      },
      {
        id: 'glm-4.5-air',
        name: 'GLM-4.5 Air',
        description: '高性价比轻量模型，适合高并发低成本场景',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥0.05 / 1M tokens',
          output: '¥0.05 / 1M tokens'
        }
      },
      {
        id: 'glm-4.6v',
        name: 'GLM-4.6V',
        description: '多模态视觉模型，支持图像理解',
        capabilities: {
          maxContextLength: 128000,
          supportsStreaming: true,
          supportsStructuredOutput: true,
          supportsVision: true,
          supportedLanguages: ['zh', 'en']
        },
        costEstimate: {
          input: '¥0.04 / 1M tokens',
          output: '¥0.1 / 1M tokens'
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
        description: 'Meta 最新开源旗舰，70B 参数版本，英文能力强',
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
        id: 'qwen3',
        name: 'Qwen3',
        description: '通义千问 3 本地版，中文支持最佳，支持思考模式',
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
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        description: '通义千问 2.5 本地版，中文支持好，稳定版本',
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
        id: 'glm4',
        name: 'GLM-4',
        description: '智谱 GLM-4 本地版，适合中文场景离线使用',
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
        description: 'DeepSeek 推理模型本地版，适合离线复杂推理任务',
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
        description: 'Google 开源轻量模型，支持多模态',
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
