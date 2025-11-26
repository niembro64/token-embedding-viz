<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ReducedEmbedding3D } from '../types/embedding';
import { normalize3D } from '../utils/pca';

const props = defineProps<{
  points: ReducedEmbedding3D[];
  width: number;
  height: number;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const hoveredToken = ref<string | null>(null);

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let pointsGroup: THREE.Group;
let labelsGroup: THREE.Group;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let animationId: number;

// Auto-rotation state
let isInteracting = false;
let currentSpeed = 0;
const maxSpeed = 2; // OrbitControls autoRotateSpeed units
const accelerationRate = 0.01;
const decelerationRate = 0.05;

function createTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = 512;
  canvas.height = 128;

  context.fillStyle = 'rgba(0, 0, 0, 0)';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.font = 'bold 64px monospace';
  context.fillStyle = '#e0e0e0';
  context.textAlign = 'left';
  context.fillText(text, 8, 80);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);

  return sprite;
}

function init() {
  if (!containerRef.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Camera - start closer on desktop
  camera = new THREE.PerspectiveCamera(60, props.width / props.height, 0.1, 1000);
  const isMobile = props.width < 768;
  const distance = isMobile ? 15 : 8;
  camera.position.set(distance, distance * 0.6, distance);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(props.width, props.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  containerRef.value.appendChild(renderer.domElement);

  // Controls with autoRotate
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0; // Start at 0, will accelerate

  // Raycaster for hover detection
  raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = 0.3;
  mouse = new THREE.Vector2();

  // Groups
  pointsGroup = new THREE.Group();
  labelsGroup = new THREE.Group();
  scene.add(pointsGroup);
  scene.add(labelsGroup);

  // Add axis helper
  const axisHelper = new THREE.AxesHelper(6);
  scene.add(axisHelper);

  // Add grid
  const gridHelper = new THREE.GridHelper(12, 12, 0x444444, 0x333333);
  scene.add(gridHelper);

  updatePoints();
  animate();

  // Event listeners for interaction tracking
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('pointerdown', onInteractionStart);
  renderer.domElement.addEventListener('pointerup', onInteractionEnd);
  renderer.domElement.addEventListener('pointerleave', onInteractionEnd);
}

function onInteractionStart() {
  isInteracting = true;
}

function onInteractionEnd() {
  isInteracting = false;
}

function updatePoints() {
  if (!pointsGroup || !labelsGroup) return;

  // Clear existing points and labels
  while (pointsGroup.children.length > 0) {
    pointsGroup.remove(pointsGroup.children[0]);
  }
  while (labelsGroup.children.length > 0) {
    labelsGroup.remove(labelsGroup.children[0]);
  }

  const normalizedPoints = normalize3D(props.points, 10);

  // Create points geometry
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];

  const color = new THREE.Color(0x4cc9f0);

  normalizedPoints.forEach((point) => {
    positions.push(point.x, point.y, point.z);
    colors.push(color.r, color.g, color.b);

    // Create label sprite
    const sprite = createTextSprite(point.token);
    sprite.position.set(point.x + 0.3, point.y + 0.2, point.z);
    sprite.userData = { token: point.token };
    labelsGroup.add(sprite);
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    sizeAttenuation: true,
  });

  const pointsMesh = new THREE.Points(geometry, material);
  pointsGroup.add(pointsMesh);
}

function handleResize() {
  if (!camera || !renderer) return;

  camera.aspect = props.width / props.height;
  camera.updateProjectionMatrix();
  renderer.setSize(props.width, props.height);
}

function onMouseMove(event: MouseEvent) {
  if (!renderer || !camera || !labelsGroup) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / props.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / props.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(labelsGroup.children);

  if (intersects.length > 0) {
    hoveredToken.value = intersects[0].object.userData.token;
  } else {
    hoveredToken.value = null;
  }
}

function animate() {
  animationId = requestAnimationFrame(animate);

  // Handle auto-rotation speed
  if (isInteracting) {
    // Decelerate when interacting
    currentSpeed = Math.max(0, currentSpeed - decelerationRate);
  } else {
    // Accelerate when not interacting
    currentSpeed = Math.min(maxSpeed, currentSpeed + accelerationRate);
  }

  // Apply speed to OrbitControls autoRotate
  controls.autoRotateSpeed = currentSpeed;
  controls.update();

  // Make labels face camera
  labelsGroup.children.forEach((sprite) => {
    sprite.lookAt(camera.position);
  });

  renderer.render(scene, camera);
}

function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (renderer) {
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('pointerdown', onInteractionStart);
    renderer.domElement.removeEventListener('pointerup', onInteractionEnd);
    renderer.domElement.removeEventListener('pointerleave', onInteractionEnd);
    renderer.dispose();
  }
  if (containerRef.value && renderer) {
    containerRef.value.removeChild(renderer.domElement);
  }
}

onMounted(() => {
  init();
});

onUnmounted(() => {
  cleanup();
});

watch(() => props.points, updatePoints, { deep: true });
watch([() => props.width, () => props.height], handleResize);
</script>

<template>
  <div class="canvas-container">
    <div ref="containerRef" class="three-container" />
    <div v-if="hoveredToken" class="hover-label">
      {{ hoveredToken }}
    </div>
    <div class="instructions">
      Drag to rotate | Scroll to zoom | Right-drag to pan
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.three-container {
  width: 100%;
  height: 100%;
}

.hover-label {
  position: absolute;
  top: 70px;
  left: 20px;
  background: rgba(51, 51, 51, 0.95);
  color: #4cc9f0;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-family: monospace;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.instructions {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.6);
  color: #888;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
}
</style>
