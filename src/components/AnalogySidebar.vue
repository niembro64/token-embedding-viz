<script setup lang="ts">
import { computed } from 'vue';
import { getResultOpacity, analogyColorOpacity, hexToRgba, analogyGroupOpacity, type AnalogyDisplayMode } from '../config/config';

export interface AnalogyResult {
  from: string;
  to: string;
  apply: string;
  results: string[];
  color: string;
}

const props = defineProps<{
  visible: boolean;
  isMobile: boolean;
  analogyResults: AnalogyResult[];
  displayMode: AnalogyDisplayMode;
  availableTokens: string[];
}>();

const emit = defineEmits<{
  close: [];
  'update:analogy': [index: number, field: 'from' | 'to' | 'apply', value: string];
}>();

const tokenSet = computed(() => new Set(props.availableTokens));

function onInput(index: number, field: 'from' | 'to' | 'apply', event: Event) {
  const value = (event.target as HTMLInputElement).value.trim().toLowerCase();
  emit('update:analogy', index, field, value);
}

function isValidToken(value: string): boolean {
  return tokenSet.value.has(value);
}

const isSingle = computed(() => props.analogyResults.length === 1);
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
        <div class="analogy-grid" :class="{ single: isSingle }">
          <div
            v-for="(result, index) in analogyResults"
            :key="index"
            class="analogy-column"
            :style="{ backgroundColor: hexToRgba(result.color, analogyGroupOpacity), border: '1px solid ' + hexToRgba(result.color, analogyGroupOpacity * 3) }"
          >
            <div class="analogy-pair">
              <input
                class="token-input"
                :class="{ invalid: !isValidToken(result.from) }"
                :value="result.from"


                spellcheck="false"
                @input="onInput(index, 'from', $event)"
              />
              <span class="connector" :style="{ color: result.color }">{{ displayMode === 'arrow' ? '▼' : displayMode === 'colon' ? ':' : 'is to' }}</span>
              <input
                class="token-input"
                :class="{ invalid: !isValidToken(result.to) }"
                :value="result.to"


                spellcheck="false"
                @input="onInput(index, 'to', $event)"
              />
            </div>
            <span class="connector" :style="{ color: result.color }">{{ displayMode === 'arrow' ? 'as' : displayMode === 'colon' ? '::' : 'as' }}</span>
            <div class="analogy-pair">
              <input
                class="token-input"
                :class="{ invalid: !isValidToken(result.apply) }"
                :value="result.apply"


                spellcheck="false"
                @input="onInput(index, 'apply', $event)"
              />
              <span class="connector" :style="{ color: result.color }">{{ displayMode === 'arrow' ? '▼' : displayMode === 'colon' ? ':' : 'is to' }}</span>
              <div class="results-list">
                <span
                  v-for="(token, i) in result.results"
                  :key="i"
                  class="token result"
                  :style="{ backgroundColor: hexToRgba(result.color, analogyColorOpacity * getResultOpacity(i)) }"
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
  gap: 3px;
  width: 90px;
  flex-shrink: 0;
  padding: 12px 8px;
  border-radius: 8px;
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

.token-input {
  font-family: monospace;
  font-size: 16px;
  font-weight: 600;
  max-width: 90px;
  width: 90px;
  color: #e0e0e0;
  background: transparent;
  border: none;
  text-align: center;
  padding: 2px 4px;
  outline: none;
}

.token-input.invalid {
  color: #888;
}

.connector {
  font-size: 12px;
  font-style: italic;
  opacity: 0.8;
}

.results-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
}

.analogy-pair .token.result {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
  color: #fff;
  max-width: none;
  overflow: visible;
}

.analogy-pair .token.result:first-child {
  font-size: 16px;
  font-weight: 700;
}

/* Single analogy — scale up to fill the space */
.analogy-grid.single .analogy-column {
  width: 200px;
  gap: 6px;
  padding: 20px 16px;
}

.analogy-grid.single .token-input {
  font-size: 24px;
  max-width: 200px;
  width: 200px;
}

.analogy-grid.single .connector {
  font-size: 16px;
}

.analogy-grid.single .analogy-pair .token.result {
  font-size: 20px;
  padding: 4px 10px;
}

.analogy-grid.single .analogy-pair .token.result:first-child {
  font-size: 24px;
}

.analogy-grid.single .results-list {
  gap: 4px;
  margin-top: 8px;
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
