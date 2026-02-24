<template>
  <div class="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between bg-muted/20">
    <div class="flex items-center gap-2">
      <!-- 从 PRD 生成按钮 -->
      <Button
        v-if="hasPrd"
        variant="outline"
        size="sm"
        class="h-7 text-xs gap-1.5"
        :disabled="isGenerating"
        @click="$emit('generateFromPrd')"
      >
        <Wand2 class="w-3 h-3" />
        {{ isGenerating ? $t('prototype.generating') : $t('prototype.generateFromPrd') }}
      </Button>

      <!-- 设备类型选择（仅在有 PRD 时显示） -->
      <div v-if="hasPrd && !hasPrototype" class="flex items-center gap-1.5">
        <Select
          :model-value="selectedDeviceType"
          @update:model-value="handleDeviceTypeChange"
        >
          <SelectTrigger class="h-7 w-auto text-xs gap-1 border-dashed">
            <Monitor v-if="selectedDeviceType === 'desktop'" class="w-3 h-3" />
            <Tablet v-else-if="selectedDeviceType === 'tablet'" class="w-3 h-3" />
            <Smartphone v-else-if="selectedDeviceType === 'mobile'" class="w-3 h-3" />
            <Layout v-else class="w-3 h-3" />
            <SelectValue :placeholder="$t('prototype.selectDeviceType')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="responsive">
              <div class="flex items-center gap-2">
                <Layout class="w-3.5 h-3.5" />
                <div>
                  <div class="text-xs font-medium">{{ $t('prototype.deviceResponsive') }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ $t('prototype.deviceResponsiveDesc') }}</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="desktop">
              <div class="flex items-center gap-2">
                <Monitor class="w-3.5 h-3.5" />
                <div>
                  <div class="text-xs font-medium">{{ $t('prototype.deviceDesktop') }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ $t('prototype.deviceDesktopDesc') }}</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="tablet">
              <div class="flex items-center gap-2">
                <Tablet class="w-3.5 h-3.5" />
                <div>
                  <div class="text-xs font-medium">{{ $t('prototype.deviceTablet') }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ $t('prototype.deviceTabletDesc') }}</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="mobile">
              <div class="flex items-center gap-2">
                <Smartphone class="w-3.5 h-3.5" />
                <div>
                  <div class="text-xs font-medium">{{ $t('prototype.deviceMobile') }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ $t('prototype.deviceMobileDesc') }}</div>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator v-if="hasPrd && hasPrototype" orientation="vertical" class="h-5" />

      <!-- 视图切换 -->
      <div v-if="hasPrototype" class="flex gap-0.5 bg-muted rounded-md p-0.5">
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6"
          :class="{ 'bg-background shadow-sm': activeView === 'preview' }"
          :title="$t('prototype.viewPreview')"
          @click="$emit('toggleView', 'preview')"
        >
          <Eye class="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6"
          :class="{ 'bg-background shadow-sm': activeView === 'code' }"
          :title="$t('prototype.viewCode')"
          @click="$emit('toggleView', 'code')"
        >
          <Code class="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6"
          :class="{ 'bg-background shadow-sm': activeView === 'split' }"
          :title="$t('prototype.viewSplit')"
          @click="$emit('toggleView', 'split')"
        >
          <Columns2 class="w-3 h-3" />
        </Button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <!-- 保存按钮 -->
      <Button
        v-if="hasPrototype"
        variant="ghost"
        size="sm"
        class="h-7 text-xs gap-1.5"
        @click="$emit('save')"
      >
        <Save class="w-3 h-3" />
        {{ $t('common.save') }}
      </Button>

      <!-- 全屏编辑按钮 -->
      <Button
        v-if="hasPrototype"
        variant="ghost"
        size="sm"
        class="h-7 text-xs gap-1.5"
        @click="$emit('openFullscreen')"
      >
        <Maximize2 class="w-3 h-3" />
        {{ $t('prototype.fullscreen') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Eye, Code, Columns2, Wand2, Save, Maximize2, Monitor, Tablet, Smartphone, Layout } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select'
import type { DeviceType } from '~/types/prototype'

defineProps<{
  hasPrototype: boolean
  hasPrd: boolean
  isGenerating: boolean
  activeView: 'preview' | 'code' | 'split'
  selectedDeviceType: DeviceType
}>()

const emit = defineEmits<{
  generateFromPrd: []
  toggleView: [view: 'preview' | 'code' | 'split']
  openFullscreen: []
  save: []
  'update:deviceType': [deviceType: DeviceType]
}>()

function handleDeviceTypeChange(value: unknown) {
  emit('update:deviceType', value as DeviceType)
}
</script>
