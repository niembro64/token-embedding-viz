<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ReducedEmbedding3D } from '../types/embedding';
import { normalize3D } from '../utils/pca';

const props = defineProps<{
  points: ReducedEmbedding3D[];
  dimensions: 0 | 1 | 2 | 3;
  width: number;
  height: number;
}>();

// Scale multipliers for each dimension
const scaleByDimension: Record<number, number> = { 0: 0.2, 1: 0.4, 2: 0.7, 3: 1.0 };

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
const maxSpeed = 2;
const accelerationRate = 0.01;
const decelerationRate = 0.05;

// Spring animation state
interface PointState {
  current: THREE.Vector3;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  currentScale: number;
  scaleVelocity: number;
  targetScale: number;
}
let pointStates: PointState[] = [];
let pointsMesh: THREE.Points | null = null;
let sprites: THREE.Sprite[] = [];
const baseScale = { x: 4, y: 1 }; // Base sprite scale

// Arrow from "italy" to "pasta" (blue shades)
let italyPastaArrow: THREE.ArrowHelper | null = null;
let italyIndex = -1;
let pastaIndex = -1;

// Token math: japan + (pasta - italy)
let japanArrow: THREE.ArrowHelper | null = null;
let japanIndex = -1;

// Arrow from "boy" to "girl" (red shades)
let boyGirlArrow: THREE.ArrowHelper | null = null;
let boyIndex = -1;
let girlIndex = -1;

// Token math: man + (girl - boy)
let manArrow: THREE.ArrowHelper | null = null;
let manIndex = -1;

// Question mark sprites at arrow tips
let japanQuestionMark: THREE.Sprite | null = null;
let manQuestionMark: THREE.Sprite | null = null;

// Spheres showing distance to nearest point
let japanSphere: THREE.Mesh | null = null;
let manSphere: THREE.Mesh | null = null;

// Helper to find distance to nearest point
function findNearestPointDistance(position: THREE.Vector3): number {
  let minDistance = Infinity;
  for (const state of pointStates) {
    const distance = position.distanceTo(state.current);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  return minDistance;
}

// Spring parameters (underdamped)
const springK = 120; // Spring stiffness
const damping = 12; // Damping coefficient (underdamped < 2*sqrt(k))
const dt = 1 / 60; // Time step

function createTextSprite(text: string, color: string = '#e0e0e0', centered: boolean = false): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = 512;
  canvas.height = 128;

  context.fillStyle = 'rgba(0, 0, 0, 0)';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.font = 'bold 64px monospace';
  context.fillStyle = color;
  context.textAlign = centered ? 'center' : 'left';
  context.fillText(text, centered ? canvas.width / 2 : 8, 80);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);
  // Center or left-align based on parameter
  sprite.center.set(centered ? 0.5 : 0, 0.5);

  return sprite;
}

function init() {
  if (!containerRef.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Camera - start closer on desktop
  camera = new THREE.PerspectiveCamera(
    60,
    props.width / props.height,
    0.1,
    1000
  );
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
  controls.autoRotateSpeed = 0;

  // Raycaster for hover detection
  raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = 0.3;
  mouse = new THREE.Vector2();

  // Groups
  pointsGroup = new THREE.Group();
  labelsGroup = new THREE.Group();
  scene.add(pointsGroup);
  scene.add(labelsGroup);

  // Add custom axes matching grid color
  const axisColor = 0x444444;
  const axisMaterial = new THREE.LineBasicMaterial({ color: axisColor });
  const axisLength = 6;

  // X axis
  const xGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(axisLength, 0, 0),
  ]);
  scene.add(new THREE.Line(xGeom, axisMaterial));

  // Y axis
  const yGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, axisLength, 0),
  ]);
  scene.add(new THREE.Line(yGeom, axisMaterial));

  // Z axis
  const zGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, axisLength),
  ]);
  scene.add(new THREE.Line(zGeom, axisMaterial));

  // Add grid
  const gridHelper = new THREE.GridHelper(12, 12, 0x444444, 0x333333);
  scene.add(gridHelper);

  initializePoints();
  animate();

  // Event listeners
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('pointerdown', onInteractionStart);
  renderer.domElement.addEventListener('pointerup', onInteractionEnd);
  renderer.domElement.addEventListener('pointerleave', onInteractionEnd);
}

function initializePoints() {
  if (!pointsGroup || !labelsGroup) return;

  const normalizedPoints = normalize3D(props.points, 10);
  const initialScale = scaleByDimension[props.dimensions];

  // Initialize point states
  pointStates = normalizedPoints.map((point) => ({
    current: new THREE.Vector3(point.x, point.y, point.z),
    velocity: new THREE.Vector3(0, 0, 0),
    target: new THREE.Vector3(point.x, point.y, point.z),
    currentScale: initialScale,
    scaleVelocity: 0,
    targetScale: initialScale,
  }));

  // Create points geometry
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(normalizedPoints.length * 3);
  const colors = new Float32Array(normalizedPoints.length * 3);

  const color = new THREE.Color(0x4cc9f0);

  normalizedPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    // Create label sprite (position will be set in animate)
    const sprite = createTextSprite(point.token);
    sprite.position.set(point.x, point.y, point.z);
    sprite.scale.set(baseScale.x * initialScale, baseScale.y * initialScale, 1);
    sprite.userData = { token: point.token, index: i };
    sprites.push(sprite);
    labelsGroup.add(sprite);
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    sizeAttenuation: true,
  });

  pointsMesh = new THREE.Points(geometry, material);
  pointsGroup.add(pointsMesh);

  // Find indices for italy, pasta, and japan
  italyIndex = normalizedPoints.findIndex((p) => p.token === 'italy');
  pastaIndex = normalizedPoints.findIndex((p) => p.token === 'pasta');
  japanIndex = normalizedPoints.findIndex((p) => p.token === 'japan');

  // Find indices for boy, girl, and man
  boyIndex = normalizedPoints.findIndex((p) => p.token === 'boy');
  girlIndex = normalizedPoints.findIndex((p) => p.token === 'girl');
  manIndex = normalizedPoints.findIndex((p) => p.token === 'man');

  // Create arrow from italy to pasta (dark blue)
  if (italyIndex !== -1 && pastaIndex !== -1) {
    const italyPos = pointStates[italyIndex].current;
    const pastaPos = pointStates[pastaIndex].current;
    const direction = new THREE.Vector3().subVectors(pastaPos, italyPos);
    const length = direction.length();
    direction.normalize();

    italyPastaArrow = new THREE.ArrowHelper(
      direction,
      italyPos,
      length,
      0x4466ff, // blue
      0.3, // head length
      0.15 // head width
    );
    scene.add(italyPastaArrow);
  }

  // Create arrow from japan using same difference (light blue) - token math!
  if (italyIndex !== -1 && pastaIndex !== -1 && japanIndex !== -1) {
    const italyPos = pointStates[italyIndex].current;
    const pastaPos = pointStates[pastaIndex].current;
    const japanPos = pointStates[japanIndex].current;
    const difference = new THREE.Vector3().subVectors(pastaPos, italyPos);
    const length = difference.length();
    difference.normalize();

    japanArrow = new THREE.ArrowHelper(
      difference,
      japanPos,
      length,
      0x4466ff, // blue
      0.3, // head length
      0.15 // head width
    );
    scene.add(japanArrow);
  }

  // Create arrow from boy to girl (dark red)
  if (boyIndex !== -1 && girlIndex !== -1) {
    const boyPos = pointStates[boyIndex].current;
    const girlPos = pointStates[girlIndex].current;
    const direction = new THREE.Vector3().subVectors(girlPos, boyPos);
    const length = direction.length();
    direction.normalize();

    boyGirlArrow = new THREE.ArrowHelper(
      direction,
      boyPos,
      length,
      0xff4444, // red
      0.3, // head length
      0.15 // head width
    );
    scene.add(boyGirlArrow);
  }

  // Create arrow from man using same difference (light red/pink) - token math!
  if (boyIndex !== -1 && girlIndex !== -1 && manIndex !== -1) {
    const boyPos = pointStates[boyIndex].current;
    const girlPos = pointStates[girlIndex].current;
    const manPos = pointStates[manIndex].current;
    const difference = new THREE.Vector3().subVectors(girlPos, boyPos);
    const length = difference.length();
    difference.normalize();

    manArrow = new THREE.ArrowHelper(
      difference,
      manPos,
      length,
      0xff4444, // red
      0.3, // head length
      0.15 // head width
    );
    scene.add(manArrow);
  }

  // Create question mark for japan arrow (blue) - 2x size, centered
  if (japanArrow) {
    japanQuestionMark = createTextSprite('?', '#4466ff', true);
    japanQuestionMark.scale.set(baseScale.x * 2 * initialScale, baseScale.y * 2 * initialScale, 1);
    scene.add(japanQuestionMark);
  }

  // Create question mark for man arrow (red) - 2x size, centered
  if (manArrow) {
    manQuestionMark = createTextSprite('?', '#ff4444', true);
    manQuestionMark.scale.set(baseScale.x * 2 * initialScale, baseScale.y * 2 * initialScale, 1);
    scene.add(manQuestionMark);
  }

  // Create sphere for japan arrow tip (blue, transparent)
  if (japanArrow) {
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x4466ff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    japanSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(japanSphere);
  }

  // Create sphere for man arrow tip (red, transparent)
  if (manArrow) {
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    manSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(manSphere);
  }
}

function updateTargets() {
  const normalizedPoints = normalize3D(props.points, 10);
  const targetScale = scaleByDimension[props.dimensions];

  // Update targets for existing points
  normalizedPoints.forEach((point, i) => {
    if (pointStates[i]) {
      pointStates[i].target.set(point.x, point.y, point.z);
      pointStates[i].targetScale = targetScale;
    }
  });
}

function updateSpringPhysics() {
  if (!pointsMesh) return;

  if (!pointsMesh?.geometry?.attributes?.position?.array) return;

  const positions = pointsMesh.geometry.attributes.position
    .array as Float32Array;

  pointStates.forEach((state, i) => {
    // Position spring physics
    const displacement = new THREE.Vector3().subVectors(
      state.current,
      state.target
    );
    const springForce = displacement.multiplyScalar(-springK);
    const dampingForce = state.velocity.clone().multiplyScalar(-damping);
    const totalForce = springForce.add(dampingForce);

    state.velocity.add(totalForce.multiplyScalar(dt));
    state.current.add(state.velocity.clone().multiplyScalar(dt));

    // Scale spring physics
    const scaleDisplacement = state.currentScale - state.targetScale;
    const scaleSpringForce = -springK * scaleDisplacement;
    const scaleDampingForce = -damping * state.scaleVelocity;
    const scaleTotalForce = scaleSpringForce + scaleDampingForce;

    state.scaleVelocity += scaleTotalForce * dt;
    state.currentScale += state.scaleVelocity * dt;

    // Update geometry
    positions[i * 3] = state.current.x;
    positions[i * 3 + 1] = state.current.y;
    positions[i * 3 + 2] = state.current.z;

    // Update sprite scale (position handled in animate)
    if (sprites[i]) {
      sprites[i].scale.set(
        baseScale.x * state.currentScale,
        baseScale.y * state.currentScale,
        1
      );
    }
  });

  pointsMesh.geometry.attributes.position.needsUpdate = true;
}

function onInteractionStart() {
  isInteracting = true;
}

function onInteractionEnd() {
  isInteracting = false;
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

  if (intersects.length > 0 && intersects[0]?.object?.userData?.token) {
    hoveredToken.value = intersects[0].object.userData.token;
  } else {
    hoveredToken.value = null;
  }
}

function animate() {
  animationId = requestAnimationFrame(animate);

  // Handle auto-rotation speed
  if (isInteracting) {
    currentSpeed = Math.max(0, currentSpeed - decelerationRate);
  } else {
    currentSpeed = Math.min(maxSpeed, currentSpeed + accelerationRate);
  }

  controls.autoRotateSpeed = currentSpeed;
  controls.update();

  // Update spring physics
  updateSpringPhysics();

  // Position labels to the right of points from camera's perspective
  const cameraRight = new THREE.Vector3();
  camera.getWorldDirection(cameraRight);
  cameraRight.cross(camera.up).normalize();

  const labelOffset = 0.3;
  labelsGroup.children.forEach((sprite, i) => {
    if (pointStates[i]) {
      const state = pointStates[i];
      sprite.position.set(
        state.current.x + cameraRight.x * labelOffset,
        state.current.y + 0.1,
        state.current.z + cameraRight.z * labelOffset
      );
    }
  });

  // Update arrow from italy to pasta (blue)
  if (italyPastaArrow && italyIndex !== -1 && pastaIndex !== -1) {
    const italyPos = pointStates[italyIndex].current;
    const pastaPos = pointStates[pastaIndex].current;
    const difference = new THREE.Vector3().subVectors(pastaPos, italyPos);
    const length = difference.length();
    difference.normalize();

    italyPastaArrow.position.copy(italyPos);
    italyPastaArrow.setDirection(difference);
    italyPastaArrow.setLength(length, 0.3, 0.15);

    // Update japan arrow with same difference (blue)
    if (japanArrow && japanIndex !== -1) {
      const japanPos = pointStates[japanIndex].current;
      japanArrow.position.copy(japanPos);
      japanArrow.setDirection(difference);
      japanArrow.setLength(length, 0.3, 0.15);

      // Position and scale question mark at arrow tip
      const tipPos = japanPos.clone().add(difference.clone().multiplyScalar(length));
      if (japanQuestionMark) {
        japanQuestionMark.position.copy(tipPos);
        const currentScale = pointStates[japanIndex].currentScale;
        japanQuestionMark.scale.set(baseScale.x * 2 * currentScale, baseScale.y * 2 * currentScale, 1);
      }

      // Position and scale sphere at arrow tip
      if (japanSphere) {
        japanSphere.position.copy(tipPos);
        const nearestDistance = findNearestPointDistance(tipPos);
        japanSphere.scale.setScalar(nearestDistance);
      }
    }
  }

  // Update arrow from boy to girl (red)
  if (boyGirlArrow && boyIndex !== -1 && girlIndex !== -1) {
    const boyPos = pointStates[boyIndex].current;
    const girlPos = pointStates[girlIndex].current;
    const difference = new THREE.Vector3().subVectors(girlPos, boyPos);
    const length = difference.length();
    difference.normalize();

    boyGirlArrow.position.copy(boyPos);
    boyGirlArrow.setDirection(difference);
    boyGirlArrow.setLength(length, 0.3, 0.15);

    // Update man arrow with same difference (red)
    if (manArrow && manIndex !== -1) {
      const manPos = pointStates[manIndex].current;
      manArrow.position.copy(manPos);
      manArrow.setDirection(difference);
      manArrow.setLength(length, 0.3, 0.15);

      // Position and scale question mark at arrow tip
      const tipPos = manPos.clone().add(difference.clone().multiplyScalar(length));
      if (manQuestionMark) {
        manQuestionMark.position.copy(tipPos);
        const currentScale = pointStates[manIndex].currentScale;
        manQuestionMark.scale.set(baseScale.x * 2 * currentScale, baseScale.y * 2 * currentScale, 1);
      }

      // Position and scale sphere at arrow tip
      if (manSphere) {
        manSphere.position.copy(tipPos);
        const nearestDistance = findNearestPointDistance(tipPos);
        manSphere.scale.setScalar(nearestDistance);
      }
    }
  }

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

// When points change, update targets (not recreate)
watch(
  () => props.points,
  () => {
    if (pointStates.length > 0) {
      updateTargets();
    } else {
      initializePoints();
    }
  },
  { deep: true }
);

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
