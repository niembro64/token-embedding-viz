<script setup lang="ts">
export type ProjectionMode = 'pca_reduction' | 'embedding_reduction' | 'embedding_full';
export type SphereCount = 0 | 1 | 5;

const props = defineProps<{
  visible: boolean;
  isMobile: boolean;
  projectionMode: ProjectionMode;
  showArrows: boolean;
  sphereCount: SphereCount;
}>();

const emit = defineEmits<{
  close: [];
  'update:projectionMode': [mode: ProjectionMode];
  'update:showArrows': [show: boolean];
  'update:sphereCount': [count: SphereCount];
}>();

function selectMode(mode: ProjectionMode) {
  emit('update:projectionMode', mode);
}

function toggleArrows() {
  emit('update:showArrows', !props.showArrows);
}

function cycleSphereCount() {
  const current = props.sphereCount;
  if (current === 0) emit('update:sphereCount', 1);
  else if (current === 1) emit('update:sphereCount', 5);
  else emit('update:sphereCount', 0);
}
</script>

<template>
  <div
    class="settings-panel"
    :class="{ 'panel-visible': visible, 'panel-mobile': isMobile }"
    @click.self="emit('close')"
  >
    <div class="panel-content">
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

      <div class="setting-group">
        <h3>Analogy Visualization</h3>
        <p class="setting-description">Configure how analogies are displayed</p>

        <div class="toggle-row">
          <span class="toggle-label">Show Arrows & Question Marks</span>
          <button
            class="toggle-switch"
            :class="{ active: showArrows }"
            @click="toggleArrows"
          >
            {{ showArrows ? 'ON' : 'OFF' }}
          </button>
        </div>

        <div class="toggle-row">
          <span class="toggle-label">Distance Spheres</span>
          <button
            class="cycle-btn"
            @click="cycleSphereCount"
          >
            {{ sphereCount === 0 ? 'None' : sphereCount === 1 ? '1 Sphere' : '5 Spheres' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: calc(100% - 70px);
  width: 320px;
  background: rgba(0, 0, 0, 0.8);
  z-index: 20;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.settings-panel.panel-visible {
  transform: translateX(0);
}

.panel-content {
  padding: 20px;
  position: relative;
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
  font-size: 1.2rem;
  color: #c084fc;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.setting-group {
  margin-bottom: 20px;
}

.setting-group h3 {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #fff;
}

.setting-description {
  margin: 0 0 16px 0;
  font-size: 0.75rem;
  color: #888;
}

.option-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.option-card.active {
  border-color: #c084fc;
  background: rgba(192, 132, 252, 0.1);
}

.option-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
}

.option-card.active .option-title {
  color: #c084fc;
}

.option-desc {
  font-size: 0.7rem;
  color: #888;
  line-height: 1.4;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 10px;
}

.toggle-label {
  font-size: 0.85rem;
  color: #fff;
}

.toggle-switch {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 50px;
}

.toggle-switch:hover {
  background: rgba(255, 255, 255, 0.15);
}

.toggle-switch.active {
  background: rgba(192, 132, 252, 0.3);
  color: #c084fc;
}

.cycle-btn {
  background: rgba(192, 132, 252, 0.2);
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #c084fc;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.cycle-btn:hover {
  background: rgba(192, 132, 252, 0.3);
}

/* Mobile - fullscreen overlay */
.panel-mobile {
  width: 100%;
  background: rgba(0, 0, 0, 0.85);
  transform: translateX(0);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.panel-mobile .panel-content {
  padding: 60px 20px 20px;
}

.panel-mobile.panel-visible {
  opacity: 1;
  pointer-events: auto;
}
</style>
