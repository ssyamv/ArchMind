<script setup lang="ts">
import { isVNode } from "vue"
import { CircleCheck, CircleX, TriangleAlert, CircleAlert } from 'lucide-vue-next'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "."
import { useToast } from "./use-toast"
import { cn } from '~/lib/utils'

const { toasts } = useToast()

const getIcon = (variant?: string | null) => {
  switch (variant ?? undefined) {
    case 'success':
      return CircleCheck
    case 'destructive':
      return CircleX
    case 'warning':
      return TriangleAlert
    default:
      return CircleAlert
  }
}

const getIconClass = (variant?: string | null) => {
  switch (variant ?? undefined) {
    case 'success':
      return 'text-green-500'
    case 'destructive':
      return 'text-red-500'
    case 'warning':
      return 'text-amber-500'
    default:
      return 'text-blue-500'
  }
}
</script>

<template>
  <ToastProvider>
    <Toast v-for="toast in toasts" :key="toast.id" v-bind="toast">
      <div class="flex items-start gap-3">
        <component
          :is="getIcon(toast.variant)"
          :class="cn('h-5 w-5 shrink-0 mt-0.5', getIconClass(toast.variant))"
        />
        <div class="grid gap-1 flex-1">
          <ToastTitle v-if="toast.title">
            {{ toast.title }}
          </ToastTitle>
          <template v-if="toast.description">
            <ToastDescription v-if="isVNode(toast.description)">
              <component :is="toast.description" />
            </ToastDescription>
            <ToastDescription v-else>
              {{ toast.description }}
            </ToastDescription>
          </template>
        </div>
        <ToastClose />
      </div>
      <component :is="toast.action" />
    </Toast>
    <ToastViewport />
  </ToastProvider>
</template>
