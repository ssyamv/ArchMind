import { ref } from 'vue'
import type { PRDGenerateRequest } from '~/types/prd'

export function usePrdGenerator () {
  const generating = ref(false)
  const content = ref('')
  const error = ref<string | null>(null)

  async function generate (userInput: string, options?: PRDGenerateRequest) {
    generating.value = true
    error.value = null
    content.value = ''

    try {
      const response = await $fetch<{ success: boolean; data: { content: string; id: string } }>('/api/v1/prd', {
        method: 'POST',
        body: { userInput, ...options }
      })

      content.value = response.data.content
      return response.data
    } catch (err: any) {
      error.value = err.message || '生成失败'
      throw err
    } finally {
      generating.value = false
    }
  }

  async function* generateStream (userInput: string, options?: PRDGenerateRequest) {
    generating.value = true
    error.value = null
    content.value = ''

    try {
      const response = await fetch('/api/v1/prd/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput, ...options })
      })

      if (!response.ok) {
        throw new Error('生成失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) { throw new Error('No response body') }

      while (true) {
        const { done, value } = await reader.read()
        if (done) { break }

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            if (data.chunk) {
              content.value += data.chunk
              yield data.chunk
            }
            if (data.done) { return }
          }
        }
      }
    } catch (err: any) {
      error.value = err.message || '生成失败'
      throw err
    } finally {
      generating.value = false
    }
  }

  return {
    generating,
    content,
    error,
    generate,
    generateStream
  }
}
