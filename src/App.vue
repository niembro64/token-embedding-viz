<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import EmbeddingCanvas3D from './components/EmbeddingCanvas3D.vue';
import BottomBar from './components/BottomBar.vue';
import AnalogySidebar from './components/AnalogySidebar.vue';
import LoadingState from './components/LoadingState.vue';
import { reduceTo3D } from './utils/pca';
import type { TokenEmbedding } from './types/types';

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

// Single PCA reduction to 3D - computed once
const points3D = computed(() => reduceTo3D(embeddings.value));

// Derive 1D/2D/3D views from the same 3D reduction
// Mapping: PC1→x, PC2→z (grid plane), PC3→y (up)
const currentPoints = computed(() => {
  const pts = points3D.value;
  if (dimensions.value === 1) {
    // PC1 only, on x-axis
    return pts.map(p => ({ token: p.token, x: p.x, y: 0, z: 0 }));
  }
  if (dimensions.value === 2) {
    // PC1→x, PC2→z (on grid plane, y=0)
    return pts.map(p => ({ token: p.token, x: p.x, y: 0, z: p.y }));
  }
  // 3D: PC1→x, PC2→z, PC3→y (up)
  return pts.map(p => ({ token: p.token, x: p.x, y: p.z, z: p.y }));
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
    const response = await fetch(`${import.meta.env.BASE_URL}glove-filtered.json`);
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
    <LoadingState :loading="loading" :error="error" />
    <template v-if="!loading && !error">
      <div class="canvas-fullscreen">
        <EmbeddingCanvas3D
          ref="canvasRef"
          :points="currentPoints"
          :dimensions="dimensions"
          :width="viewportWidth"
          :height="viewportHeight"
        />
      </div>

      <AnalogySidebar
        :visible="sidebarVisible"
        :is-mobile="isMobile"
        :analogy-results="analogyResults"
        @close="toggleSidebar"
      />

      <BottomBar
        :dimensions="dimensions"
        :token-count="embeddings.length"
        :sidebar-visible="sidebarVisible"
        @cycle-dimensions="cycleDimensions"
        @toggle-sidebar="toggleSidebar"
      />
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
</style>
