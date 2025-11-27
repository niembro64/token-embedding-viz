<script setup lang="ts">
import { getResultOpacity } from '../config/analogies';

export interface AnalogyResult {
  from: string;
  to: string;
  apply: string;
  results: string[];
  color: string;
}

defineProps<{
  visible: boolean;
  isMobile: boolean;
  analogyResults: AnalogyResult[];
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <div
    class="sidebar"
    :class="{ 'sidebar-visible': visible, 'sidebar-mobile': isMobile }"
    @click.self="emit('close')"
  >
    <div class="sidebar-content">
      <button class="close-btn" @click="emit('close')">×</button>

      <h2>Analogies</h2>

      <div class="analogy-section">
        <div class="analogy-grid">
          <div
            v-for="(result, index) in analogyResults"
            :key="index"
            class="analogy-column"
          >
            <div class="analogy-pair">
              <span class="token">{{ result.from }}</span>
              <span class="arrow" :style="{ color: result.color }">▼</span>
              <span class="token">{{ result.to }}</span>
            </div>
            <div class="analogy-pair">
              <span class="token">{{ result.apply }}</span>
              <span class="arrow" :style="{ color: result.color }">▼</span>
              <div class="results-list">
                <span
                  v-for="(token, i) in result.results"
                  :key="i"
                  class="token result"
                  :style="{ backgroundColor: result.color, opacity: getResultOpacity(i) }"
                >{{ token }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  position: absolute;
  top: 0;
  left: 0;
  height: calc(100% - 70px);
  width: 280px;
  background: rgba(0, 0, 0, 0.8);
  z-index: 10;
  overflow-y: auto;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}

.sidebar.sidebar-visible {
  transform: translateX(0);
}

.sidebar-content {
  padding: 20px;
  position: relative;
}

.analogy-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

h2 {
  margin: 0 0 24px 0;
  font-size: 1.2rem;
  color: #c084fc;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.analogy-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.analogy-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 90px;
  flex-shrink: 0;
}

.analogy-pair {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.analogy-pair .token {
  font-family: monospace;
  font-size: 16px;
  font-weight: 600;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e0e0e0;
}

.analogy-pair .arrow {
  font-size: 12px;
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
  border-radius: 4px;
  font-size: 14px;
  color: #0d1117;
}

.analogy-pair .token.result:first-child {
  font-size: 16px;
  font-weight: 700;
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

/* Mobile sidebar - fullscreen overlay */
.sidebar-mobile {
  width: 100%;
  background: rgba(0, 0, 0, 0.85);
  transform: translateX(0);
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
