import { ref, computed } from 'vue'
import type { Prototype, PrototypePage, DeviceType } from '~/types/prototype'

const STORAGE_KEY = 'prototype:active'

// 全局共享状态（单例模式），所有组件共享同一份数据
const prototype = ref<Prototype | null>(null)
const pages = ref<PrototypePage[]>([])
const activePageSlug = ref<string>('')
const isGenerating = ref(false)
const generationProgress = ref('')

// 生成阶段状态（用于 loading 动画）
const generationStage = ref<'idle' | 'connecting' | 'analyzing' | 'designing' | 'coding' | 'assembling' | 'finishing'>('idle')

// 流式生成期间的实时预览状态（不再用于实时预览渲染，仅用于数据解析）
const streamingHtml = ref('')
const streamingPages = ref<Array<{ pageSlug: string; pageName: string }>>([])
const streamingActiveSlug = ref('')

export function usePrototype () {

  // 当前活跃页面的 HTML
  const activePageHtml = computed(() => {
    const page = pages.value.find(p => p.pageSlug === activePageSlug.value)
    return page?.htmlContent || ''
  })

  // 当前活跃页面对象
  const activePage = computed(() => {
    return pages.value.find(p => p.pageSlug === activePageSlug.value) || null
  })

  // 统一预览 HTML：生成中不渲染（避免抖动），生成完成后才显示
  const previewHtml = computed(() => {
    return activePageHtml.value
  })

  // 统一页面列表：生成中返回流式解析的页面，否则返回正常 pages
  const effectivePages = computed(() => {
    if (isGenerating.value && streamingPages.value.length > 0) {
      return streamingPages.value.map((p, i) => ({
        id: '',
        prototypeId: '',
        pageName: p.pageName,
        pageSlug: p.pageSlug,
        htmlContent: '',
        sortOrder: i,
        isEntryPage: i === 0,
        createdAt: '',
        updatedAt: ''
      } as PrototypePage))
    }
    return pages.value
  })

  // 从流式累积文本中提取可渲染的 HTML
  function extractStreamingHtml (rawText: string): string {
    // 策略 1: 检测 ```html 代码块
    const codeBlockStart = rawText.indexOf('```html')
    if (codeBlockStart !== -1) {
      const contentStart = rawText.indexOf('\n', codeBlockStart) + 1
      const codeBlockEnd = rawText.indexOf('```', contentStart)
      if (codeBlockEnd !== -1) {
        return rawText.slice(contentStart, codeBlockEnd)
      }
      // 不完整代码块，取到末尾
      return rawText.slice(contentStart)
    }

    // 策略 2: 直接检测 <!DOCTYPE 或 <html
    const docTypeIdx = rawText.indexOf('<!DOCTYPE')
    if (docTypeIdx !== -1) {
      return rawText.slice(docTypeIdx)
    }

    const htmlIdx = rawText.indexOf('<html')
    if (htmlIdx !== -1) {
      return rawText.slice(htmlIdx)
    }

    return ''
  }

  // 从流式文本中解析多页面信息并返回当前页面 HTML
  function parseStreamingPages (rawText: string): {
    pages: Array<{ pageSlug: string; pageName: string }>
    currentPageHtml: string
  } {
    const pageRegex = /<!-- PAGE:(\w[\w-]*):(.+?) -->/g
    const markers: Array<{ index: number; endIndex: number; slug: string; name: string }> = []
    let match: RegExpExecArray | null

    while ((match = pageRegex.exec(rawText)) !== null) {
      markers.push({
        index: match.index,
        endIndex: match.index + match[0].length,
        slug: match[1],
        name: match[2].trim()
      })
    }

    if (markers.length === 0) {
      return {
        pages: [{ pageSlug: 'index', pageName: '首页' }],
        currentPageHtml: extractStreamingHtml(rawText)
      }
    }

    const parsedPages = markers.map(m => ({ pageSlug: m.slug, pageName: m.name }))

    // 确定当前显示哪个页面（默认最后一个，即正在生成的页面）
    const targetSlug = streamingActiveSlug.value || markers[markers.length - 1].slug
    const targetIdx = markers.findIndex(m => m.slug === targetSlug)
    const markerIdx = targetIdx >= 0 ? targetIdx : markers.length - 1

    const start = markers[markerIdx].endIndex
    const end = markerIdx < markers.length - 1 ? markers[markerIdx + 1].index : rawText.length
    const pageContent = rawText.slice(start, end)

    return {
      pages: parsedPages,
      currentPageHtml: extractStreamingHtml(pageContent)
    }
  }

  function clearStreamingState () {
    streamingHtml.value = ''
    streamingPages.value = []
    streamingActiveSlug.value = ''
  }

  // 从 localStorage 加载
  function loadFromStorage () {
    if (!import.meta.client) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        prototype.value = data.prototype
        pages.value = data.pages || []
        activePageSlug.value = data.activePageSlug || pages.value[0]?.pageSlug || ''
      } catch {
        // ignore parse error
      }
    }
  }

  function saveToStorage () {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      prototype: prototype.value,
      pages: pages.value,
      activePageSlug: activePageSlug.value
    }))
  }

  // 从 PRD 生成原型（流式）
  async function generateFromPRD (
    prdId: string,
    options: { modelId: string; pageCount?: number; deviceType?: DeviceType }
  ) {
    isGenerating.value = true
    generationProgress.value = ''
    generationStage.value = 'connecting'
    clearStreamingState()

    try {
      const response = await fetch('/api/v1/prototypes/generate-from-prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prdId,
          modelId: options.modelId,
          pageCount: options.pageCount,
          deviceType: options.deviceType
        })
      })

      if (!response.ok) throw new Error('生成失败')

      generationStage.value = 'analyzing'

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('无响应流')

      let buffer = ''
      let chunkCount = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i]
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.error) {
                throw new Error(data.error)
              }
              if (data.chunk) {
                generationProgress.value += data.chunk
                chunkCount++

                // 根据内容进度自动切换生成阶段
                const contentLen = generationProgress.value.length
                if (chunkCount <= 3) {
                  generationStage.value = 'analyzing'
                } else if (contentLen < 500) {
                  generationStage.value = 'designing'
                } else if (contentLen < 3000) {
                  generationStage.value = 'coding'
                } else {
                  generationStage.value = 'assembling'
                }

                // 仅解析页面列表用于显示进度（不渲染到 iframe）
                const parsed = parseStreamingPages(generationProgress.value)
                streamingPages.value = parsed.pages
                if (!streamingActiveSlug.value && parsed.pages.length > 0) {
                  streamingActiveSlug.value = parsed.pages[0].pageSlug
                }
              }
              if (data.done && data.prototypeId) {
                generationStage.value = 'finishing'
                // 从服务端加载完整数据
                await loadFromServer(data.prototypeId)
                clearStreamingState()
              }
            } catch (e) {
              if (e instanceof Error && e.message !== '生成失败') {
                console.error('Parse error:', e)
              } else {
                throw e
              }
            }
          }
        }
        buffer = lines[lines.length - 1] || ''
      }
    } finally {
      isGenerating.value = false
      generationStage.value = 'idle'
      if (!prototype.value) {
        clearStreamingState()
      }
    }
  }

  // 对话式编辑原型（流式）
  async function editByChat (
    message: string,
    options: {
      modelId: string
      useRAG?: boolean
      prdContent?: string
      history?: Array<{ role: string; content: string }>
    }
  ): Promise<string> {
    isGenerating.value = true

    try {
      const response = await fetch('/api/v1/prototypes/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          currentHtml: activePageHtml.value || undefined,
          currentPageSlug: activePageSlug.value || undefined,
          prdContent: options.prdContent,
          history: options.history,
          modelId: options.modelId,
          useRAG: options.useRAG
        })
      })

      if (!response.ok) throw new Error('编辑失败')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('无响应流')

      let buffer = ''
      let fullContent = ''
      let extractedHtml: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i]
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.chunk) {
                fullContent += data.chunk
              }
              if (data.done) {
                extractedHtml = data.fullHtml || null
              }
            } catch {
              // ignore parse error
            }
          }
        }
        buffer = lines[lines.length - 1] || ''
      }

      // 如果提取到了 HTML，更新当前页面
      if (extractedHtml && activePageSlug.value) {
        updatePageHtml(activePageSlug.value, extractedHtml)
      }

      return fullContent
    } finally {
      isGenerating.value = false
    }
  }

  // 更新页面 HTML
  function updatePageHtml (pageSlug: string, htmlContent: string) {
    const page = pages.value.find(p => p.pageSlug === pageSlug)
    if (page) {
      page.htmlContent = htmlContent
      page.updatedAt = new Date().toISOString()
      saveToStorage()
    }
  }

  // 添加新页面
  function addPage (pageName: string, pageSlug: string, htmlContent: string = '') {
    const newPage: PrototypePage = {
      id: '',
      prototypeId: prototype.value?.id || '',
      pageName,
      pageSlug,
      htmlContent: htmlContent || `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageName}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="container mx-auto p-8">
    <h1 class="text-2xl font-bold text-gray-900">${pageName}</h1>
    <p class="text-gray-600 mt-2">请编辑此页面的内容</p>
  </div>
</body>
</html>`,
      sortOrder: pages.value.length,
      isEntryPage: pages.value.length === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    pages.value.push(newPage)
    activePageSlug.value = pageSlug
    saveToStorage()
  }

  // 从服务端加载原型
  async function loadFromServer (prototypeId: string) {
    try {
      const response = await $fetch<{ success: boolean; data: any }>(`/api/v1/prototypes/${prototypeId}`)
      if (response.success) {
        prototype.value = response.data.prototype
        pages.value = response.data.pages
        const entryPage = pages.value.find(p => p.isEntryPage)
        activePageSlug.value = entryPage?.pageSlug || pages.value[0]?.pageSlug || ''
        saveToStorage()
        return true
      }
      return false
    } catch (error) {
      console.error('Load prototype error:', error)
      return false
    }
  }

  // 通过 PRD ID 加载关联的原型
  async function loadByPrdId (prdId: string) {
    try {
      const response = await $fetch<{ success: boolean; data: any }>('/api/v1/prototypes', {
        params: { prdId }
      })
      if (response.success && response.data.prototypes?.length > 0) {
        const latestPrototype = response.data.prototypes[0]
        return loadFromServer(latestPrototype.id)
      }
      return false
    } catch {
      return false
    }
  }

  // 保存页面到服务端
  async function savePageToServer (pageSlug: string) {
    const page = pages.value.find(p => p.pageSlug === pageSlug)
    if (!page || !page.id || !prototype.value) return

    await $fetch(`/api/v1/prototypes/${prototype.value.id}/pages/${page.id}`, {
      method: 'PUT',
      body: {
        htmlContent: page.htmlContent,
        pageName: page.pageName
      }
    })
  }

  // 保存所有页面到服务端
  async function saveAllToServer () {
    if (!prototype.value) return
    for (const page of pages.value) {
      if (page.id) {
        await savePageToServer(page.pageSlug)
      }
    }
  }

  // 重置
  function reset () {
    prototype.value = null
    pages.value = []
    activePageSlug.value = ''
    generationProgress.value = ''
    generationStage.value = 'idle'
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    prototype,
    pages,
    activePageSlug,
    activePageHtml,
    activePage,
    isGenerating,
    generationProgress,
    generationStage,
    streamingHtml,
    streamingPages,
    streamingActiveSlug,
    previewHtml,
    effectivePages,
    loadFromStorage,
    loadFromServer,
    loadByPrdId,
    generateFromPRD,
    editByChat,
    updatePageHtml,
    addPage,
    savePageToServer,
    saveAllToServer,
    reset
  }
}
