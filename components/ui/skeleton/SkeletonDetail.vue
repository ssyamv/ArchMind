<template>
  <div class="space-y-6 p-6">
    <!-- 标题 -->
    <Skeleton class="h-8 w-2/3" />
    <!-- Badge 行 -->
    <div class="flex gap-2">
      <Skeleton class="h-6 w-24 rounded-full" />
      <Skeleton class="h-6 w-16 rounded-full" />
    </div>
    <!-- 正文段落 -->
    <div class="space-y-3">
      <Skeleton v-for="i in 8" :key="i" :class="i % 4 === 0 ? 'h-4 w-3/4' : 'h-4 w-full'" />
    </div>
    <!-- 子标题 -->
    <Skeleton class="h-6 w-1/3 mt-4" />
    <div class="space-y-3">
      <Skeleton v-for="i in 5" :key="i" :class="i % 3 === 0 ? 'h-4 w-4/5' : 'h-4 w-full'" />
    </div>
  </div>
</template>
