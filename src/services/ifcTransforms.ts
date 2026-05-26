/** IFC Z-up → xeokit Y-up (rotate -90° about X). Column-major 4×4. */
export const IFC_TO_XEOKIT = [
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
];

export const IDENTITY_MAT4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

export function multiplyMat4(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export function transformVertex(matrix: number[], x: number, y: number, z: number): [number, number, number] {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

/** Apply column-major 4×4 transform to interleaved XYZ positions. */
export function transformPositions(positions: Float32Array, matrix: number[]): Float32Array {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = transformVertex(matrix, positions[i], positions[i + 1], positions[i + 2]);
    out[i] = x;
    out[i + 1] = y;
    out[i + 2] = z;
  }
  return out;
}

export function worldMatrixFromPlacement(placement?: number[]): number[] {
  return multiplyMat4(IFC_TO_XEOKIT, placement ?? IDENTITY_MAT4);
}
