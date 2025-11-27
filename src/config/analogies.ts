// Shared analogy configuration used by both visualization and sidebar

export interface AnalogyConfig {
  from: string;
  to: string;
  apply: string;
  color: string; // Hex color string
}

// Configure analogies here (colors balanced for equal perceived brightness)
export const analogies: AnalogyConfig[] = [
  { from: 'italy', to: 'pasta', apply: 'japan', color: '#60a5fa' },    // blue
  { from: 'boy', to: 'girl', apply: 'man', color: '#f87171' },         // red
  { from: 'run', to: 'ran', apply: 'walk', color: '#fbbf24' },         // yellow
  { from: 'london', to: 'england', apply: 'beijing', color: '#4ade80' }, // green
];

// Number of nearest tokens to find for each analogy
export const resultCount = 5;

// Calculate opacity for a result at index i (0-indexed)
// First result is full opacity, subsequent ones fade
export function getResultOpacity(index: number): number {
  return 1 - index * 0.15;
}

// Convert hex color to THREE.js compatible number
export function colorToHex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}
