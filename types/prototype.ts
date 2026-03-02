/**
 * 原型图类型定义
 */

// 设备类型
export type DeviceType = 'desktop' | 'tablet' | 'mobile' | 'responsive'

// 设备类型配置
export const DEVICE_CONFIGS: Record<DeviceType, { label: string; width: string; height: string; description: string }> = {
  desktop: {
    label: '桌面端',
    width: '100%',
    height: '100%',
    description: 'PC/笔记本浏览器，宽度 >= 1024px'
  },
  tablet: {
    label: '平板端',
    width: '768px',
    height: '1024px',
    description: 'iPad/Android 平板，768px - 1024px'
  },
  mobile: {
    label: '移动端',
    width: '375px',
    height: '812px',
    description: 'iPhone/Android 手机，宽度 <= 428px'
  },
  responsive: {
    label: '响应式',
    width: '100%',
    height: '100%',
    description: '自适应多种设备尺寸'
  }
}

export interface Prototype {
  id: string
  prdId?: string
  userId?: string
  title: string
  description?: string
  currentVersion: number
  status: 'draft' | 'published' | 'archived'
  deviceType: DeviceType
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface PrototypePage {
  id: string
  prototypeId: string
  pageName: string
  pageSlug: string
  htmlContent: string
  sortOrder: number
  isEntryPage: boolean
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface PrototypeVersion {
  id: string
  prototypeId: string
  versionNumber: number
  pagesSnapshot: PrototypePageSnapshot[]
  commitMessage?: string
  modelUsed?: string
  createdAt: string
}

export interface PrototypePageSnapshot {
  pageName: string
  pageSlug: string
  htmlContent: string
  sortOrder: number
  isEntryPage: boolean
}

// === API 请求/响应类型 ===

// 主题预设类型
export type ThemePreset = 'default' | 'tech' | 'nature' | 'energy' | 'pro' | 'custom'

// 主题配置
export interface ThemeConfig {
  preset: ThemePreset
  primaryColor?: string // 仅 preset='custom' 时有效，格式 #RRGGBB
}

// 主题颜色解析结果
export interface ThemeColors {
  primary: string      // 主色
  primaryLight: string // 主色 +20% 亮度
  primaryDark: string  // 主色 -20% 亮度
}

// 预设主题常量
export const THEME_PRESETS: Record<ThemePreset, ThemeColors> = {
  default: { primary: '#6366F1', primaryLight: '#818CF8', primaryDark: '#4F46E5' },
  tech:    { primary: '#2563EB', primaryLight: '#3B82F6', primaryDark: '#1D4ED8' },
  nature:  { primary: '#059669', primaryLight: '#10B981', primaryDark: '#047857' },
  energy:  { primary: '#EA580C', primaryLight: '#F97316', primaryDark: '#C2410C' },
  pro:     { primary: '#374151', primaryLight: '#6B7280', primaryDark: '#1F2937' },
  custom:  { primary: '#6366F1', primaryLight: '#818CF8', primaryDark: '#4F46E5' }
}

// 主题配置标签
export const THEME_LABELS: Record<ThemePreset, string> = {
  default: '默认紫',
  tech:    '科技蓝',
  nature:  '自然绿',
  energy:  '活力橙',
  pro:     '专业灰',
  custom:  '自定义'
}

export interface PrototypeGenerateFromPRDRequest {
  prdId: string
  modelId?: string
  temperature?: number
  maxTokens?: number
  pageCount?: number
  deviceType?: DeviceType
  theme?: ThemeConfig
}

export interface PrototypeStreamRequest {
  message: string
  prototypeId?: string
  currentPageSlug?: string
  currentHtml?: string
  prdContent?: string
  history?: Array<{ role: string; content: string }>
  modelId?: string
  useRAG?: boolean
  temperature?: number
  maxTokens?: number
}

export interface PrototypeStreamChunk {
  chunk?: string
  done?: boolean
  error?: string
  pageSlug?: string
  pageName?: string
  fullHtml?: string
}

export interface PrototypeCreateRequest {
  title: string
  prdId?: string
  description?: string
  pages: Array<{
    pageName: string
    pageSlug: string
    htmlContent: string
    sortOrder?: number
    isEntryPage?: boolean
  }>
}

export interface PrototypeUpdatePageRequest {
  htmlContent: string
  pageName?: string
}
