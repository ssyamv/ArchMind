<script setup lang="ts">
const props = defineProps<{ count?: number }>()
const _count = computed(() => props.count ?? 6)
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <SkeletonCard v-for="i in _count" :key="i" />
  </div>
</template>
