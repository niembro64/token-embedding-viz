<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import EmbeddingCanvas3D from './components/EmbeddingCanvas3D.vue';
import BottomBar from './components/BottomBar.vue';
import AnalogySidebar from './components/AnalogySidebar.vue';
import LoadingState from './components/LoadingState.vue';
import SettingsModal, { type ProjectionMode, type SphereCount, type SphereAnchor } from './components/SettingsModal.vue';
import { defaultAnalogyDisplayMode, defaultAnalogies, type AnalogyDisplayMode, type AnalogyConfig } from './config/config';
import { reduceToPCA3D, reduceToNaive3D, reduceToPCA_ND, reduceToNaiveND } from './utils/pca';
import type { TokenEmbedding, ReducedEmbeddingND } from './types/types';

const embeddings = ref<TokenEmbedding[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const dimensions = ref<1 | 2 | 3 | 4 | 5 | 50>(3);
const projectionMode = ref<ProjectionMode>('pca');
const showArrows = ref(true);
const sphereCount = ref<SphereCount>(5);
const sphereAnchor = ref<SphereAnchor>('result');
const showResultLines = ref(false);
const analogyDisplayMode = ref<AnalogyDisplayMode>(defaultAnalogyDisplayMode);
const activeAnalogies = ref<AnalogyConfig[]>(defaultAnalogies.map(a => ({ ...a })));
const showAllAnalogies = ref(false);

const visibleAnalogies = computed(() =>
  showAllAnalogies.value ? activeAnalogies.value : activeAnalogies.value.slice(0, 1)
);

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

// Reduce to 3D based on projection mode (only for visual dims 1-3)
const points3D = computed(() => {
  if (dimensions.value > 3) return [];
  if (projectionMode.value === 'pca') {
    return reduceToPCA3D(embeddings.value);
  }
  return reduceToNaive3D(embeddings.value);
});

// N-D reduced embeddings for non-visual modes (4/5/50D)
const reducedEmbeddingsND = computed<ReducedEmbeddingND[]>(() => {
  const dim = dimensions.value;
  if (dim <= 3) return [];
  if (projectionMode.value === 'pca') {
    return reduceToPCA_ND(embeddings.value, dim);
  }
  return reduceToNaiveND(embeddings.value, dim);
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

const availableTokens = computed(() => embeddings.value.map(e => e.token));

function handleAnalogyUpdate(index: number, field: 'from' | 'to' | 'apply', value: string) {
  activeAnalogies.value[index][field] = value;
}

function cycleDimensions() {
  const cycle: Record<number, 1 | 2 | 3 | 4 | 5 | 50> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 50, 50: 1 };
  dimensions.value = cycle[dimensions.value] ?? 1;
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
          :reduced-embeddings-nd="reducedEmbeddingsND"
          :show-arrows="showArrows"
          :sphere-count="sphereCount"
          :sphere-anchor="sphereAnchor"
          :show-result-lines="showResultLines"
          :analogies="visibleAnalogies"
        />
      </div>

      <AnalogySidebar
        :visible="sidebarVisible"
        :is-mobile="isMobile"
        :analogy-results="analogyResults"
        :display-mode="analogyDisplayMode"
        :available-tokens="availableTokens"
        @close="toggleSidebar"
        @update:analogy="handleAnalogyUpdate"
      />

      <SettingsModal
        :visible="settingsVisible"
        :is-mobile="isMobile"
        :projection-mode="projectionMode"
        :show-arrows="showArrows"
        :sphere-count="sphereCount"
        :sphere-anchor="sphereAnchor"
        :show-result-lines="showResultLines"
        :analogy-display-mode="analogyDisplayMode"
        :show-all-analogies="showAllAnalogies"
        @close="toggleSettings"
        @update:projection-mode="projectionMode = $event"
        @update:show-arrows="showArrows = $event"
        @update:sphere-count="sphereCount = $event"
        @update:sphere-anchor="sphereAnchor = $event"
        @update:show-result-lines="showResultLines = $event"
        @update:analogy-display-mode="analogyDisplayMode = $event"
        @update:show-all-analogies="showAllAnalogies = $event"
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
