<script setup lang="ts">
export type ProjectionMode = 'pca_reduction' | 'embedding_reduction' | 'embedding_full';

defineProps<{
  visible: boolean;
  isMobile: boolean;
  projectionMode: ProjectionMode;
}>();

const emit = defineEmits<{
  close: [];
  'update:projectionMode': [mode: ProjectionMode];
}>();

function selectMode(mode: ProjectionMode) {
  emit('update:projectionMode', mode);
}
</script>

<template>
  <div
    v-if="visible"
    class="modal-overlay"
    :class="{ 'modal-mobile': isMobile }"
    @click.self="emit('close')"
  >
    <div class="modal-content">
      <button class="close-btn" @click="emit('close')">×</button>

      <h2>Settings</h2>

      <div class="setting-group">
        <h3>Projection Mode</h3>
        <p class="setting-description">Choose how to visualize the embeddings</p>

        <div class="option-cards">
          <button
            class="option-card"
            :class="{ active: projectionMode === 'pca_reduction' }"
            @click="selectMode('pca_reduction')"
          >
            <span class="option-title">PCA Reduction</span>
            <span class="option-desc">Principal Component Analysis - finds axes of maximum variance (50D → 3D)</span>
          </button>

          <button
            class="option-card"
            :class="{ active: projectionMode === 'embedding_reduction' }"
            @click="selectMode('embedding_reduction')"
          >
            <span class="option-title">Naive Reduction</span>
            <span class="option-desc">Use first 3 dimensions of the original embedding directly (50D → 3D)</span>
          </button>

          <button
            class="option-card"
            :class="{ active: projectionMode === 'embedding_full' }"
            @click="selectMode('embedding_full')"
          >
            <span class="option-title">Full Embedding</span>
            <span class="option-desc">No dimension reduction - word analogies computed in full 50D space</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  position: relative;
  border: 1px solid #333;
}

.modal-mobile .modal-content {
  max-width: none;
  width: 100%;
  height: 100%;
  border-radius: 0;
  display: flex;
  flex-direction: column;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: none;
  width: 36px;
  height: 36px;
  font-size: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

h2 {
  margin: 0 0 24px 0;
  font-size: 1.3rem;
  color: #c084fc;
}

.setting-group {
  margin-bottom: 20px;
}

.setting-group h3 {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #fff;
}

.setting-description {
  margin: 0 0 16px 0;
  font-size: 0.8rem;
  color: #888;
}

.option-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.option-card.active {
  border-color: #c084fc;
  background: rgba(192, 132, 252, 0.1);
}

.option-title {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.option-card.active .option-title {
  color: #c084fc;
}

.option-desc {
  font-size: 0.8rem;
  color: #888;
  line-height: 1.4;
}
</style>
