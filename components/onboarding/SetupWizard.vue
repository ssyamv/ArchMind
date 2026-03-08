<script setup lang="ts">
import { ref, computed } from 'vue'
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, KeyRound } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useToast } from '~/components/ui/toast/use-toast'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  complete: []
}>()

const { toast } = useToast()
const step = ref(1)
const selectedProvider = ref('')
const apiKey = ref('')
const isTesting = ref(false)
const testPassed = ref(false)

const providers = [
  { id: 'anthropic', name: 'Claude', desc: 'Anthropic', color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
  { id: 'openai', name: 'GPT-4o', desc: 'OpenAI', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  { id: 'google', name: 'Gemini', desc: 'Google', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  { id: 'zhipu', name: 'GLM-4', desc: '智谱 AI', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  { id: 'qwen', name: '通义千问', desc: '阿里云', color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
  { id: 'wenxin', name: '文心一言', desc: '百度', color: 'bg-sky-500/10 text-sky-600 border-sky-200' },
  { id: 'deepseek', name: 'DeepSeek', desc: 'DeepSeek', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200' },
  { id: 'ollama', name: 'Ollama', desc: '本地模型', color: 'bg-gray-500/10 text-gray-600 border-gray-200' },
]

const canNext = computed(() => {
  if (step.value === 1) return !!selectedProvider.value
  if (step.value === 2) return testPassed.value
  return true
})

async function testConnection() {
  if (!apiKey.value.trim()) return
  isTesting.value = true
  testPassed.value = false
  try {
    await $fetch('/api/v1/ai/configs/validate', {
      method: 'POST',
      body: { provider: selectedProvider.value, apiKey: apiKey.value.trim() },
    })
    testPassed.value = true
    toast({ title: '连接成功', description: 'API Key 验证通过' })
  } catch {
    toast({ title: '连接失败', description: '请检查 API Key 是否正确', variant: 'destructive' })
  } finally {
    isTesting.value = false
  }
}

function next() {
  if (step.value < 3) step.value++
  else finish()
}

function prev() {
  if (step.value > 1) step.value--
}

function finish() {
  emit('complete')
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>开始使用 ArchMind</DialogTitle>
        <DialogDescription>
          完成 3 个步骤，生成你的第一份 PRD
        </DialogDescription>
      </DialogHeader>

      <!-- 步骤指示器 -->
      <div class="flex items-center gap-2 my-2">
        <template v-for="i in 3" :key="i">
          <div
            :class="[
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              i < step ? 'bg-primary text-primary-foreground' :
              i === step ? 'bg-primary/10 text-primary border border-primary' :
              'bg-muted text-muted-foreground'
            ]"
          >
            <CheckCircle2 v-if="i < step" class="w-4 h-4" />
            <span v-else>{{ i }}</span>
          </div>
          <div v-if="i < 3" class="flex-1 h-px bg-border" />
        </template>
      </div>

      <!-- 步骤 1：选择 AI 提供商 -->
      <div v-if="step === 1" class="space-y-3">
        <p class="text-sm font-medium">选择你的 AI 提供商</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="p in providers"
            :key="p.id"
            :class="[
              'flex flex-col items-start p-3 rounded-lg border text-left transition-all',
              selectedProvider === p.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-muted-foreground/40'
            ]"
            @click="selectedProvider = p.id"
          >
            <span :class="['text-xs px-1.5 py-0.5 rounded font-medium mb-1 border', p.color]">
              {{ p.desc }}
            </span>
            <span class="text-sm font-medium">{{ p.name }}</span>
          </button>
        </div>
      </div>

      <!-- 步骤 2：输入 API Key -->
      <div v-else-if="step === 2" class="space-y-4">
        <p class="text-sm font-medium">
          输入 <span class="text-primary">{{ providers.find(p => p.id === selectedProvider)?.name }}</span> API Key
        </p>
        <div class="space-y-2">
          <Label for="api-key">API Key</Label>
          <div class="relative">
            <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="api-key"
              v-model="apiKey"
              type="password"
              placeholder="sk-..."
              class="pl-9"
              @keydown.enter="testConnection"
            />
          </div>
        </div>
        <Button
          variant="outline"
          class="w-full"
          :disabled="!apiKey.trim() || isTesting"
          @click="testConnection"
        >
          <Loader2 v-if="isTesting" class="w-4 h-4 mr-2 animate-spin" />
          <CheckCircle2 v-else-if="testPassed" class="w-4 h-4 mr-2 text-green-500" />
          {{ testPassed ? '验证通过 ✓' : '测试连接' }}
        </Button>
      </div>

      <!-- 步骤 3：完成 -->
      <div v-else class="text-center space-y-4 py-4">
        <div class="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <CheckCircle2 class="w-8 h-8 text-green-500" />
        </div>
        <div>
          <p class="font-semibold">配置完成！</p>
          <p class="text-sm text-muted-foreground mt-1">现在你可以上传文档并生成 PRD 了</p>
        </div>
        <div class="flex gap-3 justify-center">
          <NuxtLink to="/knowledge-base" @click="finish">
            <Button variant="outline">上传文档</Button>
          </NuxtLink>
          <NuxtLink to="/generate?new=1" @click="finish">
            <Button>生成 PRD</Button>
          </NuxtLink>
        </div>
      </div>

      <!-- 底部导航 -->
      <div v-if="step < 3" class="flex justify-between pt-2">
        <Button variant="ghost" :disabled="step === 1" @click="prev">
          <ChevronLeft class="w-4 h-4 mr-1" />
          上一步
        </Button>
        <Button :disabled="!canNext" @click="next">
          下一步
          <ChevronRight class="w-4 h-4 ml-1" />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
