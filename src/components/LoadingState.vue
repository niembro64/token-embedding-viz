<script setup lang="ts">
defineProps<{
  loading: boolean;
  error: string | null;
}>();
</script>

<template>
  <div v-if="loading" class="status">Loading embeddings...</div>
  <div v-else-if="error" class="status error">{{ error }}</div>
</template>

<style scoped>
.status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  color: #888;
}

.status.error {
  color: #f44336;
}
</style>
