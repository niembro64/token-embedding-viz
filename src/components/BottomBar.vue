<script setup lang="ts">
defineProps<{
  dimensions: 1 | 2 | 3;
  tokenCount: number;
  sidebarVisible: boolean;
}>();

const emit = defineEmits<{
  cycleDimensions: [];
  toggleSidebar: [];
}>();
</script>

<template>
  <div class="bottom-bar">
    <div class="bottom-bar-left">
      <h1>Token Embedding Visualization</h1>
      <p class="subtitle">PCA reduction from 50D to {{ dimensions }}D · {{ tokenCount }} tokens</p>
    </div>
    <div class="bottom-bar-right">
      <p class="instructions">Drag to rotate | Scroll to zoom | Right-drag to pan</p>
      <button class="analogies-btn" :class="{ active: sidebarVisible }" @click="emit('toggleSidebar')">
        Analogies
      </button>
      <button class="toggle-btn" @click="emit('cycleDimensions')">
        {{ dimensions }}D
      </button>
    </div>
  </div>
</template>

<style scoped>
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 15;
  box-sizing: border-box;
}

.bottom-bar-left h1 {
  font-size: 1.1rem;
  color: #c084fc;
  margin: 0;
}

.bottom-bar-left .subtitle {
  font-size: 0.75rem;
  color: #888;
  margin: 4px 0 0 0;
}

.bottom-bar-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.bottom-bar-right .instructions {
  font-size: 0.7rem;
  color: #666;
  margin: 0;
}

.toggle-btn {
  background: #c084fc;
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
  background: #a855f7;
}

.toggle-btn:active {
  transform: scale(0.98);
}

.analogies-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.analogies-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.analogies-btn.active {
  background: rgba(192, 132, 252, 0.3);
  color: #c084fc;
}

.analogies-btn:active {
  transform: scale(0.98);
}

@media (max-width: 767px) {
  .bottom-bar {
    padding: 0 12px;
  }

  .bottom-bar-left h1 {
    font-size: 0.85rem;
  }

  .bottom-bar-left .subtitle {
    font-size: 0.6rem;
  }

  .bottom-bar-right .instructions {
    display: none;
  }

  .bottom-bar-right {
    gap: 8px;
  }

  .toggle-btn,
  .analogies-btn {
    padding: 8px 14px;
    font-size: 12px;
  }
}
</style>
