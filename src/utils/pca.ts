import { PCA } from 'ml-pca';
import type { TokenEmbedding, ReducedEmbedding2D, ReducedEmbedding3D } from '../types/embedding';

export function reduceTo1D(embeddings: TokenEmbedding[]): number[] {
  const matrix = embeddings.map(e => e.embedding);
  const pca = new PCA(matrix);
  const reduced = pca.predict(matrix, { nComponents: 1 });

  return embeddings.map((_, index) => {
    const row = reduced.getRow(index);
    return row[0] ?? 0;
  });
}

export function reduceTo2D(embeddings: TokenEmbedding[]): ReducedEmbedding2D[] {
  const matrix = embeddings.map(e => e.embedding);
  const pca = new PCA(matrix);
  const reduced = pca.predict(matrix, { nComponents: 2 });

  return embeddings.map((embedding, index) => {
    const row = reduced.getRow(index);
    return {
      token: embedding.token,
      x: row[0] ?? 0,
      y: row[1] ?? 0,
    };
  });
}

export function reduceTo3D(embeddings: TokenEmbedding[]): ReducedEmbedding3D[] {
  const matrix = embeddings.map(e => e.embedding);
  const pca = new PCA(matrix);
  const reduced = pca.predict(matrix, { nComponents: 3 });

  return embeddings.map((embedding, index) => {
    const row = reduced.getRow(index);
    return {
      token: embedding.token,
      x: row[0] ?? 0,
      y: row[1] ?? 0,
      z: row[2] ?? 0,
    };
  });
}

export function normalizeToCanvas(
  points: ReducedEmbedding2D[],
  width: number,
  height: number,
  padding: number = 50
): ReducedEmbedding2D[] {
  if (points.length === 0) return [];

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const availableWidth = width - 2 * padding;
  const availableHeight = height - 2 * padding;

  return points.map(point => ({
    token: point.token,
    x: padding + ((point.x - minX) / rangeX) * availableWidth,
    y: padding + ((point.y - minY) / rangeY) * availableHeight,
  }));
}

export function normalize3D(points: ReducedEmbedding3D[], scale: number = 10): ReducedEmbedding3D[] {
  if (points.length === 0) return [];

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const zs = points.map(p => p.z);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const rangeZ = maxZ - minZ;

  // If range is 0 (no variance), keep at original value
  const hasXVariance = rangeX > 0;
  const hasYVariance = rangeY > 0;
  const hasZVariance = rangeZ > 0;

  return points.map(point => ({
    token: point.token,
    x: hasXVariance ? ((point.x - minX) / rangeX - 0.5) * scale : point.x,
    y: hasYVariance ? ((point.y - minY) / rangeY - 0.5) * scale : point.y,
    z: hasZVariance ? ((point.z - minZ) / rangeZ - 0.5) * scale : point.z,
  }));
}
