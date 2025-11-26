<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ReducedEmbedding3D } from '../types/embedding';
import { normalize3D } from '../utils/pca';

const props = defineProps<{
  points: ReducedEmbedding3D[];
  dimensions: 1 | 2 | 3;
  width: number;
  height: number;
}>();

// Scale multipliers for each dimension
const scaleByDimension: Record<number, number> = { 1: 0.5, 2: 0.75, 3: 1.0 };

const containerRef = ref<HTMLDivElement | null>(null);
const hoveredToken = ref<string | null>(null);

// Track nearest tokens for each analogy (for the legend panel)
const analogyResults = ref<{ from: string; to: string; apply: string; results: string[]; color: string }[]>([]);

// Expose analogy results to parent
defineExpose({ analogyResults });

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

// Analogy definition: "from" is to "to" as "apply" is to "?"
interface Analogy {
  from: string;
  to: string;
  apply: string;
  color: number;
}

// Configure analogies here
const analogies: Analogy[] = [
  { from: 'italy', to: 'pasta', apply: 'japan', color: 0x4466ff },
  { from: 'boy', to: 'girl', apply: 'man', color: 0xff4444 },
  { from: 'run', to: 'ran', apply: 'walk', color: 0xffcc00 },
  { from: 'london', to: 'england', apply: 'beijing', color: 0x44cc44 },
];

// Runtime state for each analogy
interface AnalogyState {
  fromIndex: number;
  toIndex: number;
  applyIndex: number;
  fromToArrow: THREE.Group | null;
  applyArrow: THREE.Group | null;
  questionMark: THREE.Sprite | null;
  sphere: THREE.Mesh | null;
}

let analogyStates: AnalogyState[] = [];

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

// Helper to find the nearest tokens to a position (returns top N)
function findNearestTokens(position: THREE.Vector3, count: number = 5): string[] {
  const distances: { token: string; distance: number }[] = [];
  for (let i = 0; i < pointStates.length; i++) {
    const distance = position.distanceTo(pointStates[i].current);
    const token = props.points[i]?.token || '?';
    distances.push({ token, distance });
  }
  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, count).map((d) => d.token);
}

// Create a custom thick arrow (cylinder stem + cone head)
function createThickArrow(
  direction: THREE.Vector3,
  origin: THREE.Vector3,
  length: number,
  color: number,
  stemRadius: number = 0.04,
  headLength: number = 0.3,
  headRadius: number = 0.12
): THREE.Group {
  const group = new THREE.Group();

  const stemLength = Math.max(0.01, length - headLength);

  // Stem (cylinder)
  const stemGeometry = new THREE.CylinderGeometry(stemRadius, stemRadius, stemLength, 8);
  const stemMaterial = new THREE.MeshBasicMaterial({ color });
  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.y = stemLength / 2;
  group.add(stem);

  // Head (cone)
  const headGeometry = new THREE.ConeGeometry(headRadius, headLength, 8);
  const headMaterial = new THREE.MeshBasicMaterial({ color });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = stemLength + headLength / 2;
  group.add(head);

  // Orient the arrow to point in the given direction
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  group.position.copy(origin);

  return group;
}

// Update a thick arrow's direction and length
function updateThickArrow(
  arrow: THREE.Group,
  direction: THREE.Vector3,
  origin: THREE.Vector3,
  length: number,
  headLength: number = 0.3
) {
  const stemLength = Math.max(0.01, length - headLength);

  // Update stem
  const stem = arrow.children[0] as THREE.Mesh;
  stem.geometry.dispose();
  stem.geometry = new THREE.CylinderGeometry(0.04, 0.04, stemLength, 8);
  stem.position.y = stemLength / 2;

  // Update head position
  const head = arrow.children[1] as THREE.Mesh;
  head.position.y = stemLength + headLength / 2;

  // Update orientation and position
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  arrow.position.copy(origin);
}

// Create a Fresnel shader material for spheres (edges more visible than center)
function createFresnelSphereMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      fresnelPower: { value: 2.0 },
      opacity: { value: 0.4 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float fresnelPower;
      uniform float opacity;

      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), fresnelPower);
        gl_FragColor = vec4(color, fresnel * opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
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

  // Initialize analogies
  analogyStates = analogies.map((analogy) => {
    const fromIndex = normalizedPoints.findIndex((p) => p.token === analogy.from);
    const toIndex = normalizedPoints.findIndex((p) => p.token === analogy.to);
    const applyIndex = normalizedPoints.findIndex((p) => p.token === analogy.apply);

    const state: AnalogyState = {
      fromIndex,
      toIndex,
      applyIndex,
      fromToArrow: null,
      applyArrow: null,
      questionMark: null,
      sphere: null,
    };

    // Skip if any token not found
    if (fromIndex === -1 || toIndex === -1 || applyIndex === -1) {
      return state;
    }

    const fromPos = pointStates[fromIndex].current;
    const toPos = pointStates[toIndex].current;
    const applyPos = pointStates[applyIndex].current;
    const difference = new THREE.Vector3().subVectors(toPos, fromPos);
    const length = difference.length();
    difference.normalize();

    // Create arrow from "from" to "to"
    state.fromToArrow = createThickArrow(difference, fromPos, length, analogy.color);
    scene.add(state.fromToArrow);

    // Create arrow from "apply" using same difference
    state.applyArrow = createThickArrow(difference, applyPos, length, analogy.color);
    scene.add(state.applyArrow);

    // Create sphere at apply arrow tip with Fresnel effect (render first)
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = createFresnelSphereMaterial(analogy.color);
    state.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    state.sphere.renderOrder = 0;
    scene.add(state.sphere);

    // Create question mark at apply arrow tip (render on top of sphere)
    const colorHex = '#' + analogy.color.toString(16).padStart(6, '0');
    state.questionMark = createTextSprite('?', colorHex, true);
    state.questionMark.scale.set(baseScale.x * 2 * initialScale, baseScale.y * 2 * initialScale, 1);
    state.questionMark.renderOrder = 1;
    (state.questionMark.material as THREE.SpriteMaterial).depthTest = false;
    scene.add(state.questionMark);

    return state;
  });
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

  // Update all analogies and track results
  const newResults: typeof analogyResults.value = [];

  analogyStates.forEach((state, index) => {
    const analogy = analogies[index];
    const colorHex = '#' + analogy.color.toString(16).padStart(6, '0');

    if (state.fromIndex === -1 || state.toIndex === -1 || state.applyIndex === -1) {
      newResults.push({
        from: analogy.from,
        to: analogy.to,
        apply: analogy.apply,
        results: ['?'],
        color: colorHex,
      });
      return;
    }

    const fromPos = pointStates[state.fromIndex].current;
    const toPos = pointStates[state.toIndex].current;
    const applyPos = pointStates[state.applyIndex].current;
    const difference = new THREE.Vector3().subVectors(toPos, fromPos);
    const length = difference.length();
    difference.normalize();

    // Update from->to arrow
    if (state.fromToArrow) {
      updateThickArrow(state.fromToArrow, difference, fromPos, length);
    }

    // Update apply arrow
    if (state.applyArrow) {
      updateThickArrow(state.applyArrow, difference, applyPos, length);
    }

    // Position and scale question mark at apply arrow tip
    const tipPos = applyPos.clone().add(difference.clone().multiplyScalar(length));
    if (state.questionMark) {
      state.questionMark.position.copy(tipPos);
      const currentScale = pointStates[state.applyIndex].currentScale;
      state.questionMark.scale.set(baseScale.x * 2 * currentScale, baseScale.y * 2 * currentScale, 1);
    }

    // Position and scale sphere at apply arrow tip
    if (state.sphere) {
      state.sphere.position.copy(tipPos);
      const nearestDistance = findNearestPointDistance(tipPos);
      state.sphere.scale.setScalar(nearestDistance);
    }

    // Track the nearest tokens for the legend
    const nearestTokens = findNearestTokens(tipPos, 5);
    newResults.push({
      from: analogy.from,
      to: analogy.to,
      apply: analogy.apply,
      results: nearestTokens,
      color: colorHex,
    });
  });

  analogyResults.value = newResults;

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
