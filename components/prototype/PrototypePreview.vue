<template>
  <div class="relative w-full h-full bg-white dark:bg-gray-900">
    <!-- 设备切换按钮 -->
    <div class="absolute top-2 right-2 z-10 flex gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1 border border-border">
      <Button
        v-for="device in devices"
        :key="device.name"
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="{ 'bg-accent': activeDevice === device.name }"
        :title="device.label"
        @click="activeDevice = device.name"
      >
        <Monitor v-if="device.name === 'desktop'" class="w-3.5 h-3.5" />
        <Tablet v-else-if="device.name === 'tablet'" class="w-3.5 h-3.5" />
        <Smartphone v-else class="w-3.5 h-3.5" />
      </Button>
    </div>

    <!-- iframe 容器 -->
    <div class="w-full h-full flex items-start justify-center overflow-auto p-4 bg-muted/30">
      <div
        v-if="!html"
        class="flex items-center justify-center h-full text-muted-foreground"
      >
        <div class="text-center">
          <Layout class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p class="text-sm">{{ $t('prototype.emptyPreview') }}</p>
        </div>
      </div>
      <iframe
        v-else
        ref="iframeRef"
        :srcdoc="disableInteractionHtml"
        sandbox="allow-scripts"
        :style="iframeStyle"
        class="border border-border rounded-lg shadow-sm bg-white transition-all duration-300"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Monitor, Smartphone, Tablet, Layout } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'

const { t } = useI18n()

const props = defineProps<{
  html: string
}>()

const iframeRef = ref<HTMLIFrameElement>()
const activeDevice = ref('desktop')

const devices = computed(() => [
  { name: 'desktop', label: t('prototype.deviceDesktop'), width: '100%', height: '100%' },
  { name: 'tablet', label: t('prototype.deviceTablet'), width: '768px', height: '1024px' },
  { name: 'mobile', label: t('prototype.deviceMobile'), width: '375px', height: '812px' }
])

const iframeStyle = computed(() => {
  const device = devices.value.find(d => d.name === activeDevice.value)
  return {
    width: device?.width || '100%',
    height: device?.height || '100%',
    maxWidth: '100%',
    maxHeight: '100%'
  }
})

/**
 * 对 AI 生成的 HTML 进行后处理，修复常见兼容性问题
 * 不论使用哪个模型生成，都能确保原型正常显示
 */
function sanitizeHtml(html: string): string {
  let result = html

  // 1. 替换旧版/不可用的 Tailwind CDN 为稳定 CDN
  result = result.replace(
    /https:\/\/cdn\.tailwindcss\.com[^\s"']*/g,
    'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
  )
  result = result.replace(
    /https:\/\/unpkg\.com\/tailwindcss@[^\s"']*/g,
    'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
  )

  // 2. 移除 Canvas API 调用，替换为提示占位符
  // 匹配 <canvas ...> 标签，替换为占位 div（保留 id 以防 JS 引用）
  result = result.replace(
    /<canvas([^>]*)>/gi,
    (match, attrs) => {
      const idMatch = attrs.match(/id=["']([^"']+)["']/i)
      const idAttr = idMatch ? ` id="${idMatch[1]}"` : ''
      const widthMatch = attrs.match(/width=["']?(\d+)["']?/i)
      const heightMatch = attrs.match(/height=["']?(\d+)["']?/i)
      const w = widthMatch ? widthMatch[1] + 'px' : '100%'
      const h = heightMatch ? heightMatch[1] + 'px' : '120px'
      return `<div${idAttr} style="width:${w};height:${h};background:#f3f4f6;border:1px dashed #d1d5db;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">`
    }
  )
  result = result.replace(/<\/canvas>/gi, '</div>')

  // 3. 包裹不安全的内联 JS（防止 canvas/chart 相关异常导致整页崩溃）
  result = result.replace(
    /<script(\s[^>]*)?>(\s*)([\s\S]*?)(<\/script>)/gi,
    (_, attrs, space, code, closing) => {
      const attrsStr = attrs || ''
      // 跳过：外部脚本、空脚本、已有 try-catch 的、注入的 polyfill
      if (
        attrsStr.includes(' src=') ||
        attrsStr.includes(" src='") ||
        !code.trim() ||
        code.includes('try {') ||
        code.includes('getContext = function')
      ) {
        return `<script${attrsStr}>${space}${code}${closing}`
      }
      return `<script>${space}try {\n${code}\n} catch(e) { console.warn('[Prototype] Script error suppressed:', e && e.message); }${closing}`
    }
  )

  return result
}

// 注入 CSS 禁用原型内的交互，防止点击产生错误效果
const disableInteractionHtml = computed(() => {
  if (!props.html) return ''

  // 先对原始 HTML 进行后处理修复
  const sanitized = sanitizeHtml(props.html)

  const injectedHead = `
    <script>
      // 过滤 Tailwind CDN 的生产环境警告
      (function() {
        var _warn = console.warn;
        console.warn = function() {
          if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].indexOf('cdn.tailwindcss.com') !== -1) return;
          _warn.apply(console, arguments);
        };
      })();
      // Tailwind CDN 加载失败时自动切换备用 CDN
      (function() {
        var cdns = [
          'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
          'https://unpkg.com/tailwindcss-cdn@3.4.16/tailwindcss.js'
        ];
        function tryLoadCdn(index) {
          if (index >= cdns.length) return;
          var s = document.createElement('script');
          s.src = cdns[index];
          s.onerror = function() { tryLoadCdn(index + 1); };
          document.head.appendChild(s);
        }
        // 仅当页面未引入 tailwind 时才注入
        window.addEventListener('DOMContentLoaded', function() {
          var hasTailwind = Array.from(document.scripts).some(function(s) {
            return s.src && (s.src.indexOf('tailwindcss') !== -1 || s.src.indexOf('tailwind') !== -1);
          });
          if (!hasTailwind) { tryLoadCdn(0); }
        });
      })();
      // 拦截 getContext 防止 canvas 替换后 JS 报错
      (function() {
        var _getElementById = document.getElementById.bind(document);
        document.getElementById = function(id) {
          var el = _getElementById(id);
          if (el && el.tagName !== 'CANVAS' && !el.getContext) {
            el.getContext = function() { return null; };
          }
          return el;
        };
        var _querySelector = document.querySelector.bind(document);
        document.querySelector = function(sel) {
          var el = _querySelector(sel);
          if (el && el.tagName !== 'CANVAS' && !el.getContext) {
            el.getContext = function() { return null; };
          }
          return el;
        };
      })();
    <\/script>
    <style>
      /* 禁用所有交互，原型仅用于视觉预览 */
      *, *::before, *::after {
        pointer-events: none !important;
        cursor: default !important;
        user-select: none !important;
      }
      /* 保持滚动功能 */
      html, body {
        overflow: auto !important;
      }
    </style>
  `

  // 在 </head> 或 <html> 后注入样式
  if (sanitized.includes('</head>')) {
    return sanitized.replace('</head>', `${injectedHead}</head>`)
  } else if (sanitized.includes('<html')) {
    return sanitized.replace(/<html[^>]*>/, `$&${injectedHead}`)
  } else {
    return injectedHead + sanitized
  }
})
</script>
