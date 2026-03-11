<script setup lang="ts">
const props = defineProps<{ rows?: number; cols?: number }>()
const _rows = computed(() => props.rows ?? 5)
const _cols = computed(() => props.cols ?? 4)
</script>

<template>
  <div class="w-full overflow-auto">
    <table class="w-full">
      <!-- 表头 -->
      <thead>
        <tr class="border-b border-border">
          <th v-for="i in _cols" :key="i" class="px-4 py-3 text-left">
            <Skeleton class="h-4 w-20" />
          </th>
        </tr>
      </thead>
      <!-- 表格行 -->
      <tbody>
        <tr v-for="row in _rows" :key="row" class="border-b border-border last:border-0">
          <td v-for="col in _cols" :key="col" class="px-4 py-3">
            <Skeleton :class="col === 1 ? 'h-4 w-40' : 'h-4 w-24'" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
