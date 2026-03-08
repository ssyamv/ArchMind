<template>
  <div class="flex flex-col gap-2 p-3">
    <!-- 工作区切换器 -->
    <div class="flex items-center gap-2 px-2 py-1.5">
      <Skeleton class="h-7 w-7 rounded-md flex-shrink-0" />
      <Skeleton class="h-4 flex-1" />
    </div>
    <div class="mt-1 space-y-1">
      <!-- 导航项 -->
      <Skeleton v-for="i in 5" :key="i" class="h-8 w-full rounded-md" />
    </div>
    <div class="mt-4 space-y-1">
      <Skeleton class="h-3 w-16 ml-2 mb-2" />
      <Skeleton v-for="i in 3" :key="i" class="h-7 w-full rounded-md" />
    </div>
  </div>
</template>
