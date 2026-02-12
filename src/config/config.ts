// =============================================================================
// CENTRALIZED CONFIGURATION
// All configurable values for the Token Embedding Visualization
// =============================================================================

// -----------------------------------------------------------------------------
// COLORS
// -----------------------------------------------------------------------------

export const colors = {
  // Scene
  background: 0x111111,

  // Theme accent (purple)
  accent: '#c084fc',
  accentHex: 0xc084fc,

  // Text
  labelText: '#e0e0e0',
  subtitleText: '#888888',

  // Grid and axes
  axis: 0x444444,
  gridPrimary: 0x444444,
  gridSecondary: 0x333333,

  // Points
  point: 0xffffff,
  // point: 0xc084fc,
};

// -----------------------------------------------------------------------------
// ANALOGIES
// -----------------------------------------------------------------------------

export interface AnalogyConfig {
  from: string;
  to: string;
  apply: string;
  color: string; // Hex color string
}

// Configure analogies here (colors balanced for equal perceived brightness)
export const defaultAnalogies: AnalogyConfig[] = [
  { from: 'italy', to: 'pasta', apply: 'japan', color: '#60a5fa' }, // blue
  { from: 'boy', to: 'girl', apply: 'man', color: '#f87171' }, // red
  { from: 'run', to: 'ran', apply: 'walk', color: '#fbbf24' }, // yellow
  { from: 'london', to: 'england', apply: 'beijing', color: '#4ade80' }, // green
];
// export const analogies: AnalogyConfig[] = [
//   { from: 'italy', to: 'pasta', apply: 'japan', color: '#60a5fa' },    // blue
//   { from: 'boy', to: 'girl', apply: 'man', color: '#f87171' },         // red
//   { from: 'run', to: 'ran', apply: 'walk', color: '#fbbf24' },         // yellow
//   { from: 'london', to: 'england', apply: 'beijing', color: '#4ade80' }, // green
// ];

// Analogy display format
export type AnalogyDisplayMode = 'colon' | 'arrow' | 'text';
// 'colon' = "a : b :: c : d"
// 'arrow' = "a > b as c > d"
// 'text'  = "a is to b as c is to d"
export const defaultAnalogyDisplayMode: AnalogyDisplayMode = 'text';

// Number of nearest tokens to find for each analogy
export const resultCount = 5;

// Base opacity for analogy colors (applied to sidebar backgrounds and spheres)
export const analogyColorOpacity = 0.6;

// Opacity for analogy group background in sidebar
export const analogyGroupOpacity = 0.1;

// Opacity fade rate per result index
export const opacityFadeRate = 0.2;

// Calculate opacity for a result at index i (0-indexed)
// First result is full opacity, subsequent ones fade
export function getResultOpacity(index: number): number {
  return 1 - index * opacityFadeRate;
}

// Convert hex color string to THREE.js compatible number
export function colorToHex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

// Convert hex color to rgba string with opacity
export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// -----------------------------------------------------------------------------
// ANIMATION & PHYSICS
// -----------------------------------------------------------------------------

export const animation = {
  // Spring physics (underdamped)
  springK: 120, // Spring stiffness
  damping: 12, // Damping coefficient (underdamped < 2*sqrt(k))
  dt: 1 / 60, // Time step

  // Auto-rotation
  maxSpeed: 2,
  accelerationRate: 0.01,
  decelerationRate: 0.05,

  // Controls
  dampingFactor: 0.05,
};

// -----------------------------------------------------------------------------
// DIMENSIONS & SCALES
// -----------------------------------------------------------------------------

export const scales = {
  // Scale multipliers for each dimension view
  byDimension: { 1: 0.5, 2: 0.75, 3: 1.0, 4: 1.0, 5: 1.0, 50: 1.0 } as Record<number, number>,

  // Base sprite scale for labels
  baseSprite: { x: 4, y: 1 },

  // Normalization scale for point cloud
  pointCloud: 10,
};

// -----------------------------------------------------------------------------
// ARROWS
// -----------------------------------------------------------------------------

export const arrow = {
  stemRadius: 0.04,
  headLength: 0.3,
  headRadius: 0.12,
};

// -----------------------------------------------------------------------------
// SPHERES (Fresnel effect)
// -----------------------------------------------------------------------------

export const sphere = {
  fresnelPower: 2.0,
  baseOpacity: 0.4,
  segments: 32,
};

// -----------------------------------------------------------------------------
// CAMERA
// -----------------------------------------------------------------------------

export const camera = {
  fov: 60,
  near: 0.1,
  far: 1000,
  distanceDesktop: 8,
  distanceMobile: 15,
  heightRatio: 0.6, // Camera height as ratio of distance
};

// -----------------------------------------------------------------------------
// GRID & AXES
// -----------------------------------------------------------------------------

export const grid = {
  size: 12,
  divisions: 12,
};

export const axis = {
  length: 6,
};

// -----------------------------------------------------------------------------
// TEXT SPRITES
// -----------------------------------------------------------------------------

export const textSprite = {
  canvasWidth: 512,
  canvasHeight: 128,
  fontSize: 64,
  fontFamily: 'monospace',
};

// -----------------------------------------------------------------------------
// MISC
// -----------------------------------------------------------------------------

export const misc = {
  mobileBreakpoint: 768,
  raycasterThreshold: 0.3,
  pointSize: 0.2,
};
