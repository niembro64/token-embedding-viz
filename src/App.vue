<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import EmbeddingCanvas3D from './components/EmbeddingCanvas3D.vue';
import { reduceTo2D, reduceTo3D } from './utils/pca';
import type { TokenEmbedding } from './types/embedding';

const embeddings = ref<TokenEmbedding[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const is3D = ref(true);

const viewportWidth = ref(window.innerWidth);
const viewportHeight = ref(window.innerHeight);

const points2D = computed(() => {
  const reduced = reduceTo2D(embeddings.value);
  // Convert 2D points to 3D on XZ plane (Y=0 is the grid plane in Three.js)
  return reduced.map(p => ({ token: p.token, x: p.x, y: 0, z: p.y }));
});

const points3D = computed(() => reduceTo3D(embeddings.value));

const currentPoints = computed(() => is3D.value ? points3D.value : points2D.value);

function toggleView() {
  is3D.value = !is3D.value;
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
          :points="currentPoints"
          :width="viewportWidth"
          :height="viewportHeight"
        />
      </div>

      <div class="overlay-header">
        <h1>Token Embedding Visualization</h1>
        <p class="subtitle">PCA reduction from 50D to {{ is3D ? '3D' : '2D' }}</p>
      </div>

      <div class="overlay-controls">
        <button class="toggle-btn" @click="toggleView">
          {{ is3D ? '2D' : '3D' }}
        </button>
      </div>

      <div class="overlay-info">
        {{ embeddings.length }} tokens
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

.overlay-header {
  position: absolute;
  top: 20px;
  left: 20px;
  pointer-events: none;
  z-index: 10;
}

.overlay-header h1 {
  font-size: 1.4rem;
  color: #4cc9f0;
  margin: 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.overlay-header .subtitle {
  font-size: 0.85rem;
  color: #888;
  margin: 4px 0 0 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.overlay-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
}

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

.overlay-info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  font-size: 0.8rem;
  color: #666;
  z-index: 10;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}
</style>
