<script setup lang="ts">
import type { AnalogyDisplayMode } from '../config/config';

export type ProjectionMode = 'pca' | 'naive';
export type SphereCount = 0 | 1 | 5;
export type SphereAnchor = 'result' | 'token';

const props = defineProps<{
  visible: boolean;
  isMobile: boolean;
  projectionMode: ProjectionMode;
  showArrows: boolean;
  sphereCount: SphereCount;
  sphereAnchor: SphereAnchor;
  analogyDisplayMode: AnalogyDisplayMode;
  showAllAnalogies: boolean;
}>();

const emit = defineEmits<{
  close: [];
  'update:projectionMode': [mode: ProjectionMode];
  'update:showArrows': [show: boolean];
  'update:sphereCount': [count: SphereCount];
  'update:sphereAnchor': [anchor: SphereAnchor];
  'update:analogyDisplayMode': [mode: AnalogyDisplayMode];
  'update:showAllAnalogies': [show: boolean];
}>();

function cycleProjectionMode() {
  if (props.projectionMode === 'pca') emit('update:projectionMode', 'naive');
  else emit('update:projectionMode', 'pca');
}

function getProjectionModeLabel(mode: ProjectionMode): string {
  switch (mode) {
    case 'pca': return 'PCA';
    case 'naive': return 'Naive';
  }
}

function getProjectionModeDesc(mode: ProjectionMode): string {
  switch (mode) {
    case 'pca': return 'Principal Component Analysis finds axes of maximum variance';
    case 'naive': return 'Uses first N dimensions of the original embedding';
  }
}

function toggleArrows() {
  emit('update:showArrows', !props.showArrows);
}

function toggleShowAllAnalogies() {
  emit('update:showAllAnalogies', !props.showAllAnalogies);
}

function cycleSphereCount() {
  const current = props.sphereCount;
  if (current === 0) emit('update:sphereCount', 1);
  else if (current === 1) emit('update:sphereCount', 5);
  else emit('update:sphereCount', 0);
}

function cycleSphereAnchor() {
  if (props.sphereAnchor === 'result') emit('update:sphereAnchor', 'token');
  else emit('update:sphereAnchor', 'result');
}

function cycleAnalogyDisplayMode() {
  const current = props.analogyDisplayMode;
  if (current === 'arrow') emit('update:analogyDisplayMode', 'colon');
  else if (current === 'colon') emit('update:analogyDisplayMode', 'text');
  else emit('update:analogyDisplayMode', 'arrow');
}

function getAnalogyDisplayLabel(mode: AnalogyDisplayMode): string {
  switch (mode) {
    case 'arrow': return 'a → b as c → d';
    case 'colon': return 'a : b :: c : d';
    case 'text': return 'a is to b as c is to d';
  }
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

        <div class="toggle-row with-desc">
          <span class="toggle-label">Visualization</span>
          <button
            class="cycle-btn"
            @click="cycleProjectionMode"
          >
            {{ getProjectionModeLabel(projectionMode) }}
          </button>
        </div>
        <p class="setting-description inline-desc">{{ getProjectionModeDesc(projectionMode) }}</p>
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

        <div class="toggle-row">
          <span class="toggle-label">Sphere Center</span>
          <button
            class="cycle-btn"
            @click="cycleSphereAnchor"
          >
            {{ sphereAnchor === 'result' ? 'Result' : 'Token' }}
          </button>
        </div>

        <div class="toggle-row">
          <span class="toggle-label">Display Format</span>
          <button
            class="cycle-btn"
            @click="cycleAnalogyDisplayMode"
          >
            {{ getAnalogyDisplayLabel(analogyDisplayMode) }}
          </button>
        </div>

        <div class="toggle-row">
          <span class="toggle-label">Show All Analogies</span>
          <button
            class="toggle-switch"
            :class="{ active: showAllAnalogies }"
            @click="toggleShowAllAnalogies"
          >
            {{ showAllAnalogies ? 'ON' : 'OFF' }}
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

.setting-description.inline-desc {
  margin: -2px 12px 16px 12px;
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

.toggle-row.with-desc {
  margin-bottom: 8px;
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
