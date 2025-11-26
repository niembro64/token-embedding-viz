<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import EmbeddingCanvas3D from './components/EmbeddingCanvas3D.vue';
import { reduceTo1D, reduceTo2D, reduceTo3D } from './utils/pca';
import type { TokenEmbedding } from './types/embedding';

const embeddings = ref<TokenEmbedding[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const dimensions = ref<1 | 2 | 3>(3);

const viewportWidth = ref(window.innerWidth);
const viewportHeight = ref(window.innerHeight);

// Reference to the 3D canvas component to access analogy results
const canvasRef = ref<InstanceType<typeof EmbeddingCanvas3D> | null>(null);

const analogyResults = computed(() => canvasRef.value?.analogyResults ?? []);

// Sidebar visibility (for mobile)
const sidebarVisible = ref(false);
const isMobile = computed(() => viewportWidth.value < 768);

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value;
}

const points1D = computed(() => {
  const reduced = reduceTo1D(embeddings.value);
  // Convert 1D points to 3D on X axis (Y=0, Z=0)
  return embeddings.value.map((e, i) => ({ token: e.token, x: reduced[i], y: 0, z: 0 }));
});

const points2D = computed(() => {
  const reduced = reduceTo2D(embeddings.value);
  // Convert 2D points to 3D on XZ plane (Y=0 is the grid plane in Three.js)
  return reduced.map(p => ({ token: p.token, x: p.x, y: 0, z: p.y }));
});

const points3D = computed(() => reduceTo3D(embeddings.value));

const currentPoints = computed(() => {
  if (dimensions.value === 1) return points1D.value;
  if (dimensions.value === 2) return points2D.value;
  return points3D.value;
});

function cycleDimensions() {
  if (dimensions.value === 3) dimensions.value = 1;
  else if (dimensions.value === 1) dimensions.value = 2;
  else dimensions.value = 3;
}

function handleResize() {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
}

onMounted(async () => {
  window.addEventListener('resize', handleResize);

  try {
    const response = await fetch('/glove-filtered.json');
    if (!response.ok) {
      throw new Error(`Failed to load embeddings: ${response.statusText}`);
    }
    embeddings.value = await response.json();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="app">
    <div v-if="loading" class="status">Loading embeddings...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>
    <template v-else>
      <div class="canvas-fullscreen">
        <EmbeddingCanvas3D
          ref="canvasRef"
          :points="currentPoints"
          :dimensions="dimensions"
          :width="viewportWidth"
          :height="viewportHeight"
        />
      </div>

      <!-- Mobile: floating controls always visible -->
      <div v-if="isMobile" class="mobile-controls">
        <button class="toggle-btn" @click="cycleDimensions">
          {{ dimensions }}D
        </button>
        <button class="info-btn" @click="toggleSidebar">
          ℹ
        </button>
      </div>

      <!-- Sidebar / Info panel -->
      <div
        class="sidebar"
        :class="{ 'sidebar-visible': sidebarVisible, 'sidebar-mobile': isMobile }"
        @click.self="isMobile && toggleSidebar()"
      >
        <div class="sidebar-content">
          <button v-if="isMobile" class="close-btn" @click="toggleSidebar">×</button>

          <div class="sidebar-header">
            <h1>Token Embedding Visualization</h1>
            <p class="subtitle">PCA reduction from 50D to {{ dimensions }}D</p>
            <p class="token-count">{{ embeddings.length }} tokens</p>
          </div>

          <div class="analogy-section">
            <h2>Word Analogies</h2>
            <div class="analogy-grid">
              <div
                v-for="(result, index) in analogyResults"
                :key="index"
                class="analogy-column"
              >
                <div class="analogy-pair">
                  <span class="token" :style="{ color: result.color }">{{ result.from }}</span>
                  <span class="arrow" :style="{ color: result.color }">↓</span>
                  <span class="token" :style="{ color: result.color }">{{ result.to }}</span>
                </div>
                <div class="analogy-pair">
                  <span class="token" :style="{ color: result.color }">{{ result.apply }}</span>
                  <span class="arrow" :style="{ color: result.color }">↓</span>
                  <div class="results-list">
                    <span
                      v-for="(token, i) in result.results"
                      :key="i"
                      class="token result"
                      :style="{ color: result.color, opacity: 1 - i * 0.15 }"
                    >{{ token }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Desktop: controls at bottom of sidebar -->
          <div v-if="!isMobile" class="sidebar-footer">
            <button class="toggle-btn" @click="cycleDimensions">
              {{ dimensions }}D
            </button>
            <p class="instructions">Drag to rotate | Scroll to zoom | Right-drag to pan</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  height: 100dvh;
  position: relative;
  overflow: hidden;
}

.canvas-fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

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

/* Sidebar - Desktop */
.sidebar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 280px;
  background: rgba(0, 0, 0, 0.8);
  z-index: 10;
  overflow-y: auto;
}

.sidebar-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100%;
  box-sizing: border-box;
}

.sidebar-header h1 {
  font-size: 1.2rem;
  color: #4cc9f0;
  margin: 0 0 8px 0;
}

.sidebar-header .subtitle {
  font-size: 0.85rem;
  color: #888;
  margin: 0;
}

.sidebar-header .token-count {
  font-size: 0.75rem;
  color: #666;
  margin: 4px 0 0 0;
}

.analogy-section h2 {
  font-size: 0.9rem;
  color: #aaa;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.analogy-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: flex-start;
}

.analogy-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 70px;
}

.analogy-pair {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.analogy-pair .token {
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
}

.analogy-pair .arrow {
  font-size: 14px;
  line-height: 1;
}

.results-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.analogy-pair .token.result {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 11px;
}

.analogy-pair .token.result:first-child {
  font-size: 13px;
  font-weight: 700;
}

/* Sidebar footer - Desktop */
.sidebar-footer {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-footer .instructions {
  font-size: 0.7rem;
  color: #666;
  margin: 12px 0 0 0;
}

/* Buttons */
.toggle-btn {
  background: #4cc9f0;
  color: #0d1117;
  border: none;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.toggle-btn:hover {
  background: #3db8df;
}

.toggle-btn:active {
  transform: scale(0.98);
}

.info-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  width: 44px;
  height: 44px;
  font-size: 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.info-btn:hover {
  background: rgba(255, 255, 255, 0.25);
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

/* Mobile controls - always visible */
.mobile-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 20;
}

/* Mobile sidebar - fullscreen overlay */
.sidebar-mobile {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.sidebar-mobile .sidebar-content {
  position: relative;
  padding: 60px 20px 20px;
}

.sidebar-mobile.sidebar-visible {
  opacity: 1;
  pointer-events: auto;
}

.sidebar-mobile .analogy-grid {
  justify-content: center;
}
</style>
