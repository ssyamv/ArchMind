// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  app: {
    head: {
      title: 'ArchMind AI',
      meta: [
        { name: 'description', content: 'Transform ideas into deliverables with RAG-based AI reasoning' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' }
      ]
    }
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/color-mode',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@sentry/nuxt/module'
  ],

  // Sentry 错误监控配置
  // 仅在 SENTRY_DSN 环境变量存在时启用，本地开发默认关闭
  // Source Map 上传需额外配置 SENTRY_AUTH_TOKEN、SENTRY_ORG、SENTRY_PROJECT（CI/CD 环境）
  sentry: {
    ...(process.env.SENTRY_AUTH_TOKEN
      ? {
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN
        }
      : {}),
    autoUploadSourcemaps: !!process.env.SENTRY_AUTH_TOKEN
  },

  tailwindcss: {
    configPath: '~/tailwind.config.ts',
    cssPath: '~/assets/css/main.css',
    exposeConfig: false
  },

  vite: {
    build: {
      cssCodeSplit: false
    }
  },

  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'zh-CN', name: '简体中文', file: 'zh-CN.json' },
      { code: 'zh', name: '简体中文', file: 'zh-CN.json' }
    ],
    defaultLocale: 'zh-CN',
    strategy: 'no_prefix',
    langDir: 'lang',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root',
      alwaysRedirect: true
    },
    compilation: {
      strictMessage: false,
      escapeHtml: false
    }
  },

  components: [
    {
      path: '~/components',
      pathPrefix: false,
      ignore: ['**/ui/**/index.ts']
    }
  ],

  colorMode: {
    classSuffix: ''
  },

  typescript: {
    strict: true,
    typeCheck: false
  },

  runtimeConfig: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    glmApiKey: process.env.GLM_API_KEY,
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
    baiduApiKey: process.env.BAIDU_API_KEY,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    databasePath: process.env.DATABASE_PATH || './data/database.db',
    emailHost: process.env.EMAIL_HOST || 'smtp.qq.com',
    emailPort: parseInt(process.env.EMAIL_PORT || '465'),
    emailSecure: process.env.EMAIL_SECURE !== 'false',
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
    emailFrom: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    public: {
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      baseUrl: process.env.BASE_URL || process.env.APP_URL || 'http://localhost:3000',
      // Sentry 前端 DSN（空字符串 = 禁用）
      sentryDsn: process.env.SENTRY_DSN || '',
      // 应用环境，供 Sentry 区分事件来源
      appEnv: process.env.NODE_ENV || 'production'
    }
  },

  nitro: {
    preset: process.env.VERCEL ? 'vercel' : 'node-server'
  },

  compatibilityDate: '2024-01-01'
})
