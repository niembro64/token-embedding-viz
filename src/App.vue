<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import EmbeddingCanvas3D from './components/EmbeddingCanvas3D.vue';
import BottomBar from './components/BottomBar.vue';
import AnalogySidebar from './components/AnalogySidebar.vue';
import LoadingState from './components/LoadingState.vue';
import SettingsModal, { type ProjectionMode, type SphereCount } from './components/SettingsModal.vue';
import { reduceToPCA3D, reduceToNaive3D } from './utils/pca';
import type { TokenEmbedding } from './types/types';

const embeddings = ref<TokenEmbedding[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const dimensions = ref<1 | 2 | 3>(3);
const projectionMode = ref<ProjectionMode>('pca_reduction');
const showArrows = ref(true);
const sphereCount = ref<SphereCount>(1);

const viewportWidth = ref(window.innerWidth);
const viewportHeight = ref(window.innerHeight);

// Reference to the 3D canvas component to access analogy results
const canvasRef = ref<InstanceType<typeof EmbeddingCanvas3D> | null>(null);

const analogyResults = computed(() => canvasRef.value?.analogyResults ?? []);

// Sidebar visibility (show by default on desktop, hide on mobile)
const isMobile = computed(() => viewportWidth.value < 768);
const sidebarVisible = ref(window.innerWidth >= 768);
const settingsVisible = ref(false);

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value;
}

function toggleSettings() {
  settingsVisible.value = !settingsVisible.value;
}

// Reduce to 3D based on projection mode
const points3D = computed(() => {
  if (projectionMode.value === 'pca_reduction') {
    return reduceToPCA3D(embeddings.value);
  }
  if (projectionMode.value === 'embedding_reduction') {
    return reduceToNaive3D(embeddings.value);
  }
  // For embedding_full, return empty array (no 3D visualization)
  return [];
});

// Derive 1D/2D/3D views from the same 3D reduction
// Mapping: PC1→x, PC2→z (grid plane), PC3→y (up)
const currentPoints = computed(() => {
  const pts = points3D.value;
  if (dimensions.value === 1) {
    // First component only, on x-axis
    return pts.map(p => ({ token: p.token, x: p.x, y: 0, z: 0 }));
  }
  if (dimensions.value === 2) {
    // First two components: x→x, y→z (on grid plane, y=0)
    return pts.map(p => ({ token: p.token, x: p.x, y: 0, z: p.y }));
  }
  // 3D: x→x, y→z, z→y (up)
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
          :projection-mode="projectionMode"
          :original-embeddings="embeddings"
          :show-arrows="showArrows"
          :sphere-count="sphereCount"
        />
      </div>

      <AnalogySidebar
        :visible="sidebarVisible"
        :is-mobile="isMobile"
        :analogy-results="analogyResults"
        @close="toggleSidebar"
      />

      <SettingsModal
        :visible="settingsVisible"
        :is-mobile="isMobile"
        :projection-mode="projectionMode"
        :show-arrows="showArrows"
        :sphere-count="sphereCount"
        @close="toggleSettings"
        @update:projection-mode="projectionMode = $event"
        @update:show-arrows="showArrows = $event"
        @update:sphere-count="sphereCount = $event"
      />

      <BottomBar
        :dimensions="dimensions"
        :token-count="embeddings.length"
        :sidebar-visible="sidebarVisible"
        :settings-visible="settingsVisible"
        :projection-mode="projectionMode"
        @cycle-dimensions="cycleDimensions"
        @toggle-sidebar="toggleSidebar"
        @toggle-settings="toggleSettings"
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
