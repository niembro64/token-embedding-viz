export interface TokenEmbedding {
  token: string;
  embedding: number[];
}

export interface ReducedEmbedding2D {
  token: string;
  x: number;
  y: number;
}

export interface ReducedEmbedding3D {
  token: string;
  x: number;
  y: number;
  z: number;
}
