<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ReducedEmbedding3D, TokenEmbedding } from '../types/types';
import type { ProjectionMode, SphereCount } from './SettingsModal.vue';
import { normalize3D } from '../utils/pca';
import {
  colors,
  resultCount,
  getResultOpacity,
  colorToHex,
  analogyColorOpacity,
  animation,
  scales,
  arrow,
  sphere,
  camera as cameraConfig,
  grid,
  axis,
  textSprite,
  misc,
  type AnalogyConfig,
} from '../config/config';

const props = defineProps<{
  points: ReducedEmbedding3D[];
  dimensions: 1 | 2 | 3;
  width: number;
  height: number;
  projectionMode: ProjectionMode;
  originalEmbeddings: TokenEmbedding[];
  showArrows: boolean;
  sphereCount: SphereCount;
  analogies: AnalogyConfig[];
}>();

// Scale multipliers for each dimension (from config)
const scaleByDimension = scales.byDimension;

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
let noVisualGroup: THREE.Group;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let animationId: number;

// Auto-rotation state
let isInteracting = false;
let currentSpeed = 0;

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
const baseScale = scales.baseSprite;

// Runtime state for each analogy
interface AnalogyState {
  fromIndex: number;
  toIndex: number;
  applyIndex: number;
  fromToArrow: THREE.Group | null;
  applyArrow: THREE.Group | null;
  questionMark: THREE.Sprite | null;
  spheres: THREE.Mesh[]; // Array of spheres (up to 5)
}

let analogyStates: AnalogyState[] = [];

// Helper to find the nearest tokens and their distances to a position (returns top N)
function findNearestTokensWithDistances(position: THREE.Vector3, count: number = 5): { token: string; distance: number }[] {
  const distances: { token: string; distance: number }[] = [];
  for (let i = 0; i < pointStates.length; i++) {
    const state = pointStates[i];
    if (!state) continue;
    const distance = position.distanceTo(state.current);
    const token = props.points[i]?.token || '?';
    distances.push({ token, distance });
  }
  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, count);
}

// Helper to find nearest tokens in full 50D embedding space
function findNearestTokensFullEmbedding(targetEmbedding: number[], count: number = 5): string[] {
  const distances: { token: string; distance: number }[] = [];

  for (const embedding of props.originalEmbeddings) {
    // Euclidean distance in 50D
    let sum = 0;
    for (let i = 0; i < targetEmbedding.length; i++) {
      const diff = (targetEmbedding[i] ?? 0) - (embedding.embedding[i] ?? 0);
      sum += diff * diff;
    }
    distances.push({ token: embedding.token, distance: Math.sqrt(sum) });
  }

  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, count).map((d) => d.token);
}

// Compute analogies using full 50D embeddings
function computeFullEmbeddingAnalogies(): typeof analogyResults.value {
  const results: typeof analogyResults.value = [];

  for (const analogy of props.analogies) {
    const fromEmb = props.originalEmbeddings.find(e => e.token === analogy.from);
    const toEmb = props.originalEmbeddings.find(e => e.token === analogy.to);
    const applyEmb = props.originalEmbeddings.find(e => e.token === analogy.apply);

    if (!fromEmb || !toEmb || !applyEmb) {
      results.push({
        from: analogy.from,
        to: analogy.to,
        apply: analogy.apply,
        results: ['?'],
        color: analogy.color,
      });
      continue;
    }

    // Compute: result = apply + (to - from)
    const resultEmbedding: number[] = [];
    for (let i = 0; i < applyEmb.embedding.length; i++) {
      const diff = (toEmb.embedding[i] ?? 0) - (fromEmb.embedding[i] ?? 0);
      resultEmbedding.push((applyEmb.embedding[i] ?? 0) + diff);
    }

    // Find nearest tokens to the result embedding
    const nearestTokens = findNearestTokensFullEmbedding(resultEmbedding, resultCount);

    results.push({
      from: analogy.from,
      to: analogy.to,
      apply: analogy.apply,
      results: nearestTokens,
      color: analogy.color,
    });
  }

  return results;
}

// Create a custom thick arrow (cylinder stem + cone head)
function createThickArrow(
  direction: THREE.Vector3,
  origin: THREE.Vector3,
  length: number,
  color: number,
  stemRadius: number = arrow.stemRadius,
  headLength: number = arrow.headLength,
  headRadius: number = arrow.headRadius
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
  arrowGroup: THREE.Group,
  direction: THREE.Vector3,
  origin: THREE.Vector3,
  length: number,
  headLength: number = arrow.headLength
) {
  const stemLength = Math.max(0.01, length - headLength);

  // Update stem
  const stem = arrowGroup.children[0] as THREE.Mesh;
  stem.geometry.dispose();
  stem.geometry = new THREE.CylinderGeometry(arrow.stemRadius, arrow.stemRadius, stemLength, 8);
  stem.position.y = stemLength / 2;

  // Update head position
  const head = arrowGroup.children[1] as THREE.Mesh;
  head.position.y = stemLength + headLength / 2;

  // Update orientation and position
  arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  arrowGroup.position.copy(origin);
}

// Create a Fresnel shader material for spheres (edges more visible than center)
function createFresnelSphereMaterial(color: number, opacity: number = sphere.baseOpacity): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      fresnelPower: { value: sphere.fresnelPower },
      opacity: { value: opacity },
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

// Spring parameters from config
const { springK, damping, dt } = animation;

function createTextSprite(text: string, color: string = colors.labelText, centered: boolean = false, fontSize: number = textSprite.fontSize): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = textSprite.canvasWidth;
  canvas.height = textSprite.canvasHeight;

  // Clear to fully transparent
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.font = `bold ${fontSize}px ${textSprite.fontFamily}`;
  context.fillStyle = color;
  context.textAlign = centered ? 'center' : 'left';
  context.fillText(text, centered ? canvas.width / 2 : 8, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.premultiplyAlpha = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.01,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);
  // Center or left-align based on parameter
  sprite.center.set(centered ? 0.5 : 0, 0.5);

  return sprite;
}

function createNoVisualMessage() {
  noVisualGroup = new THREE.Group();

  // "No Visual Possible" text
  const line1 = createTextSprite('No Visual Possible', '#888888', true, 48);
  line1.scale.set(8, 2, 1);
  line1.position.set(0, 1, 0);
  noVisualGroup.add(line1);

  // "50 Dimensions" text
  const line2 = createTextSprite('50 Dimensions', '#c084fc', true, 56);
  line2.scale.set(6, 1.5, 1);
  line2.position.set(0, -0.5, 0);
  noVisualGroup.add(line2);

  noVisualGroup.visible = false;
  scene.add(noVisualGroup);
}

function init() {
  if (!containerRef.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.background);

  // Camera - start closer on desktop
  camera = new THREE.PerspectiveCamera(
    cameraConfig.fov,
    props.width / props.height,
    cameraConfig.near,
    cameraConfig.far
  );
  const isMobile = props.width < misc.mobileBreakpoint;
  const distance = isMobile ? cameraConfig.distanceMobile : cameraConfig.distanceDesktop;
  camera.position.set(distance, distance * cameraConfig.heightRatio, distance);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(props.width, props.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  containerRef.value.appendChild(renderer.domElement);

  // Controls with autoRotate
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = animation.dampingFactor;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0;

  // Raycaster for hover detection
  raycaster = new THREE.Raycaster();
  raycaster.params.Points!.threshold = misc.raycasterThreshold;
  mouse = new THREE.Vector2();

  // Groups
  pointsGroup = new THREE.Group();
  labelsGroup = new THREE.Group();
  scene.add(pointsGroup);
  scene.add(labelsGroup);

  // Add custom axes matching grid color
  const axisMaterial = new THREE.LineBasicMaterial({ color: colors.axis });

  // X axis
  const xGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(axis.length, 0, 0),
  ]);
  scene.add(new THREE.Line(xGeom, axisMaterial));

  // Y axis
  const yGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, axis.length, 0),
  ]);
  scene.add(new THREE.Line(yGeom, axisMaterial));

  // Z axis
  const zGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, axis.length),
  ]);
  scene.add(new THREE.Line(zGeom, axisMaterial));

  // Add grid
  const gridHelper = new THREE.GridHelper(grid.size, grid.divisions, colors.gridPrimary, colors.gridSecondary);
  scene.add(gridHelper);

  // Create "No Visual Possible" message (hidden by default)
  createNoVisualMessage();

  // Initialize based on mode
  if (props.projectionMode !== 'embedding_full') {
    initializePoints();
  } else {
    // In full mode, just compute analogies
    analogyResults.value = computeFullEmbeddingAnalogies();
  }

  updateVisibility();
  animate();

  // Event listeners
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('pointerdown', onInteractionStart);
  renderer.domElement.addEventListener('pointerup', onInteractionEnd);
  renderer.domElement.addEventListener('pointerleave', onInteractionEnd);
}

function updateVisibility() {
  const isFullMode = props.projectionMode === 'embedding_full';

  // Toggle visibility of 3D elements
  pointsGroup.visible = !isFullMode;
  labelsGroup.visible = !isFullMode;

  // Toggle visibility of analogy arrows/spheres
  for (const state of analogyStates) {
    if (state.fromToArrow) state.fromToArrow.visible = !isFullMode && props.showArrows;
    if (state.applyArrow) state.applyArrow.visible = !isFullMode && props.showArrows;
    if (state.questionMark) state.questionMark.visible = !isFullMode && props.showArrows;
    // Update sphere visibility based on sphereCount
    state.spheres.forEach((sphere, i) => {
      sphere.visible = !isFullMode && props.sphereCount > i;
    });
  }

  // Toggle "No Visual" message
  if (noVisualGroup) {
    noVisualGroup.visible = isFullMode;
  }
}

function initializePoints() {
  if (!pointsGroup || !labelsGroup) return;
  if (props.points.length === 0) return;

  const normalizedPoints = normalize3D(props.points, scales.pointCloud);
  const initialScale = scaleByDimension[props.dimensions] ?? 1.0;

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
  const vertexColors = new Float32Array(normalizedPoints.length * 3);

  const color = new THREE.Color(colors.point);

  normalizedPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
    vertexColors[i * 3] = color.r;
    vertexColors[i * 3 + 1] = color.g;
    vertexColors[i * 3 + 2] = color.b;

    // Create label sprite (position will be set in animate)
    const sprite = createTextSprite(point.token);
    sprite.position.set(point.x, point.y, point.z);
    sprite.scale.set(baseScale.x * initialScale, baseScale.y * initialScale, 1);
    sprite.userData = { token: point.token, index: i };
    sprites.push(sprite);
    labelsGroup.add(sprite);
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));

  const material = new THREE.PointsMaterial({
    size: misc.pointSize,
    vertexColors: true,
    sizeAttenuation: true,
  });

  pointsMesh = new THREE.Points(geometry, material);
  pointsGroup.add(pointsMesh);

  // Initialize analogies
  analogyStates = props.analogies.map((analogy) => {
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
      spheres: [],
    };

    // Skip if any token not found
    if (fromIndex === -1 || toIndex === -1 || applyIndex === -1) {
      return state;
    }

    const fromState = pointStates[fromIndex];
    const toState = pointStates[toIndex];
    const applyState = pointStates[applyIndex];
    if (!fromState || !toState || !applyState) return state;

    const fromPos = fromState.current;
    const toPos = toState.current;
    const applyPos = applyState.current;
    const difference = new THREE.Vector3().subVectors(toPos, fromPos);
    const length = difference.length();
    difference.normalize();

    const colorNum = colorToHex(analogy.color);

    // Create arrow from "from" to "to"
    state.fromToArrow = createThickArrow(difference, fromPos, length, colorNum);
    state.fromToArrow.visible = props.showArrows;
    scene.add(state.fromToArrow);

    // Create arrow from "apply" using same difference
    state.applyArrow = createThickArrow(difference, applyPos, length, colorNum);
    state.applyArrow.visible = props.showArrows;
    scene.add(state.applyArrow);

    // Create spheres at apply arrow tip with Fresnel effect (decreasing opacity)
    for (let i = 0; i < resultCount; i++) {
      const sphereGeometry = new THREE.SphereGeometry(1, sphere.segments, sphere.segments);
      // Opacity decreases for each subsequent sphere using shared config
      const sphereOpacity = sphere.baseOpacity * analogyColorOpacity * getResultOpacity(i);
      const sphereMaterial = createFresnelSphereMaterial(colorNum, sphereOpacity);
      const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphereMesh.renderOrder = 0;
      // Initially hide based on sphereCount setting
      sphereMesh.visible = props.sphereCount > i;
      scene.add(sphereMesh);
      state.spheres.push(sphereMesh);
    }

    // Create question mark at apply arrow tip (render on top of sphere)
    state.questionMark = createTextSprite('?', analogy.color, true);
    state.questionMark.scale.set(baseScale.x * 2 * initialScale, baseScale.y * 2 * initialScale, 1);
    state.questionMark.renderOrder = 1;
    (state.questionMark.material as THREE.SpriteMaterial).depthTest = false;
    state.questionMark.visible = props.showArrows;
    scene.add(state.questionMark);

    return state;
  });
}

function cleanupAnalogies() {
  for (const state of analogyStates) {
    if (state.fromToArrow) { scene.remove(state.fromToArrow); }
    if (state.applyArrow) { scene.remove(state.applyArrow); }
    if (state.questionMark) { scene.remove(state.questionMark); }
    for (const s of state.spheres) { scene.remove(s); }
  }
  analogyStates = [];
}

function initializeAnalogies() {
  if (!scene || pointStates.length === 0) return;

  const normalizedPoints = normalize3D(props.points, scales.pointCloud);
  const initialScale = scaleByDimension[props.dimensions] ?? 1.0;

  analogyStates = props.analogies.map((analogy) => {
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
      spheres: [],
    };

    if (fromIndex === -1 || toIndex === -1 || applyIndex === -1) {
      return state;
    }

    const fromState = pointStates[fromIndex];
    const toState = pointStates[toIndex];
    const applyState = pointStates[applyIndex];
    if (!fromState || !toState || !applyState) return state;

    const fromPos = fromState.current;
    const toPos = toState.current;
    const applyPos = applyState.current;
    const difference = new THREE.Vector3().subVectors(toPos, fromPos);
    const length = difference.length();
    difference.normalize();

    const colorNum = colorToHex(analogy.color);

    state.fromToArrow = createThickArrow(difference, fromPos, length, colorNum);
    state.fromToArrow.visible = props.showArrows;
    scene.add(state.fromToArrow);

    state.applyArrow = createThickArrow(difference, applyPos, length, colorNum);
    state.applyArrow.visible = props.showArrows;
    scene.add(state.applyArrow);

    for (let i = 0; i < resultCount; i++) {
      const sphereGeometry = new THREE.SphereGeometry(1, sphere.segments, sphere.segments);
      const sphereOpacity = sphere.baseOpacity * analogyColorOpacity * getResultOpacity(i);
      const sphereMaterial = createFresnelSphereMaterial(colorNum, sphereOpacity);
      const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphereMesh.renderOrder = 0;
      sphereMesh.visible = props.sphereCount > i;
      scene.add(sphereMesh);
      state.spheres.push(sphereMesh);
    }

    state.questionMark = createTextSprite('?', analogy.color, true);
    state.questionMark.scale.set(baseScale.x * 2 * initialScale, baseScale.y * 2 * initialScale, 1);
    state.questionMark.renderOrder = 1;
    (state.questionMark.material as THREE.SpriteMaterial).depthTest = false;
    state.questionMark.visible = props.showArrows;
    scene.add(state.questionMark);

    return state;
  });
}

function updateTargets() {
  if (props.points.length === 0) return;

  const normalizedPoints = normalize3D(props.points, scales.pointCloud);
  const targetScale = scaleByDimension[props.dimensions] ?? 1.0;

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
    currentSpeed = Math.max(0, currentSpeed - animation.decelerationRate);
  } else {
    currentSpeed = Math.min(animation.maxSpeed, currentSpeed + animation.accelerationRate);
  }

  controls.autoRotateSpeed = currentSpeed;
  controls.update();

  // In full mode, just render and skip point updates
  if (props.projectionMode === 'embedding_full') {
    renderer.render(scene, camera);
    return;
  }

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
    const analogy = props.analogies[index];
    if (!analogy) return;

    if (state.fromIndex === -1 || state.toIndex === -1 || state.applyIndex === -1) {
      newResults.push({
        from: analogy.from,
        to: analogy.to,
        apply: analogy.apply,
        results: ['?'],
        color: analogy.color,
      });
      return;
    }

    const fromPointState = pointStates[state.fromIndex];
    const toPointState = pointStates[state.toIndex];
    const applyPointState = pointStates[state.applyIndex];
    if (!fromPointState || !toPointState || !applyPointState) return;

    const fromPos = fromPointState.current;
    const toPos = toPointState.current;
    const applyPos = applyPointState.current;
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
      const currentScale = applyPointState.currentScale;
      state.questionMark.scale.set(baseScale.x * 2 * currentScale, baseScale.y * 2 * currentScale, 1);
    }

    // Get nearest tokens with distances for both spheres and legend
    const nearestWithDistances = findNearestTokensWithDistances(tipPos, resultCount);

    // Position and scale all spheres at apply arrow tip
    state.spheres.forEach((sphere, i) => {
      sphere.position.copy(tipPos);
      const dist = nearestWithDistances[i]?.distance ?? 0;
      sphere.scale.setScalar(dist);
    });

    // Track the nearest tokens for the legend
    const nearestTokens = nearestWithDistances.map(d => d.token);
    newResults.push({
      from: analogy.from,
      to: analogy.to,
      apply: analogy.apply,
      results: nearestTokens,
      color: analogy.color,
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
    if (props.projectionMode === 'embedding_full') {
      // In full mode, recompute analogies with full embeddings
      analogyResults.value = computeFullEmbeddingAnalogies();
      return;
    }

    if (props.points.length === 0) return;

    if (pointStates.length > 0) {
      updateTargets();
    } else {
      initializePoints();
    }
  },
  { deep: true }
);

// Watch for projection mode changes
watch(
  () => props.projectionMode,
  (newMode) => {
    updateVisibility();

    if (newMode === 'embedding_full') {
      // Compute analogies using full embeddings
      analogyResults.value = computeFullEmbeddingAnalogies();
    } else if (props.points.length > 0) {
      // Make sure points are initialized for non-full modes
      if (pointStates.length === 0) {
        initializePoints();
      }
    }
  }
);

watch([() => props.width, () => props.height], handleResize);

// Watch for showArrows and sphereCount changes
watch(
  [() => props.showArrows, () => props.sphereCount],
  () => {
    updateVisibility();
  }
);

// Watch for analogies prop changes (word edits or count changes)
watch(
  () => props.analogies,
  () => {
    cleanupAnalogies();
    if (props.projectionMode === 'embedding_full') {
      analogyResults.value = computeFullEmbeddingAnalogies();
    } else if (pointStates.length > 0) {
      initializeAnalogies();
      updateVisibility();
    }
  },
  { deep: true }
);
</script>

<template>
  <div class="canvas-container">
    <div ref="containerRef" class="three-container" />
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
</style>
