<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue'

withDefaults(
  defineProps<{
    description?: string
  }>(),
  { description: '没有读取到本地数据，请检查后重试。' },
)

defineEmits<{
  retry: []
}>()
</script>

<template>
  <EmptyState title="数据加载失败" :description="description">
    <button class="secondary-button retry-button" @click="$emit('retry')">重新加载</button>
  </EmptyState>
</template>

<style scoped>
.retry-button {
  margin-top: 24rpx;
}
</style>
