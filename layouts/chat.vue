<template>
  <div class="h-screen flex flex-col bg-background">
    <Toaster />
    <!-- Floating back button -->
    <div class="absolute top-4 left-4 z-50">
      <Button
        variant="ghost"
        size="icon"
        class="h-9 w-9 rounded-full bg-background/60 backdrop-blur-sm border shadow-sm hover:bg-background/80"
        @click="goBack"
      >
        <ArrowLeft class="h-4 w-4" />
      </Button>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Toaster } from '~/components/ui/toast'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

onMounted(async () => {
  await authStore.checkAuth()
})

function goBack() {
  const loadPrdId = route.query.loadPrd as string | undefined
  if (loadPrdId) {
    router.push(`/projects/${loadPrdId}`)
  } else if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/app')
  }
}
</script>
