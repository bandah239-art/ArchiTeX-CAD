import { resolveSiteBounds as resolveMergedSiteBounds } from './selectionBridge';

export interface SiteBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  spanX: number;
  spanZ: number;
  floorY: number;
}

export interface ContourLine {
  elevationM: number;
  points: [number, number, number][];
}

export interface ElevationGrid {
  rows: number;
  cols: number;
  cellSizeM: number;
  originX: number;
  originZ: number;
  values: number[][];
}

export interface FloodGrid {
  size: number;
  cellSizeM: number;
  originX: number;
  originZ: number;
  depths: number[][];
}

export interface GeoOverlayInput {
  terrain?: Record<string, unknown> | null;
  flood?: Record<string, unknown> | null;
  floorY: number;
  platformAreaM2?: number;
  showContours?: boolean;
  showTerrain?: boolean;
  showFlood?: boolean;
}

export function resolveSiteBounds(floorY: number, platformAreaM2 = 400): SiteBounds {
  return resolveMergedSiteBounds(floorY, platformAreaM2);
}

function parseElevationGrid(raw: unknown, bounds: SiteBounds): ElevationGrid | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const rows = Number(g.rows);
  const cols = Number(g.cols);
  const values = g.values;
  if (!rows || !cols || !Array.isArray(values)) return null;

  const cellSizeM = Number(g.cell_size_m) || bounds.spanX / Math.max(cols - 1, 1);
  const originX = Number(g.origin_x) ?? bounds.minX;
  const originZ = Number(g.origin_z) ?? bounds.minZ;

  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row = values[r];
    if (!Array.isArray(row)) return null;
    grid.push(row.map((v) => Number(v)));
  }
  return { rows, cols, cellSizeM, originX, originZ, values: grid };
}

function parseContourLines(raw: unknown, floorY: number): ContourLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: ContourLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const elevationM = Number(row.elevation_m ?? row.elevation);
    const pts = row.points;
    if (!Array.isArray(pts)) continue;
    const points: [number, number, number][] = [];
    for (const p of pts) {
      if (!Array.isArray(p) || p.length < 2) continue;
      points.push([Number(p[0]), floorY + 0.05, Number(p[1])]);
    }
    if (points.length >= 2 && Number.isFinite(elevationM)) {
      lines.push({ elevationM, points });
    }
  }
  return lines;
}

export function synthesizeElevationGrid(
  bounds: SiteBounds,
  elevationM: number,
  slopeDeg: number,
  rows = 24,
  cols = 24,
): ElevationGrid {
  const cellSizeM = bounds.spanX / Math.max(cols - 1, 1);
  const slopeRad = (slopeDeg * Math.PI) / 180;
  const gradient = Math.tan(slopeRad);
  const values: number[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const lx = bounds.minX + c * cellSizeM - bounds.centerX;
      const lz = bounds.minZ + r * cellSizeM - bounds.centerZ;
      const elev = elevationM + gradient * (lx * 0.6 + lz * 0.4);
      row.push(elev);
    }
    values.push(row);
  }

  return {
    rows,
    cols,
    cellSizeM,
    originX: bounds.minX,
    originZ: bounds.minZ,
    values,
  };
}

/** Extract contour segments by scanning grid row/column edges. */
export function contoursFromGrid(grid: ElevationGrid, bounds: SiteBounds, levels = 5): ContourLine[] {
  const flat = grid.values.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  if (max - min < 0.01) return [];

  const lines: ContourLine[] = [];
  const floorY = bounds.floorY;

  for (let li = 1; li <= levels; li++) {
    const level = min + ((max - min) * li) / (levels + 1);
    const segments: [number, number, number][] = [];

    for (let r = 0; r < grid.rows; r++) {
      const rowPts: [number, number, number][] = [];
      for (let c = 0; c < grid.cols - 1; c++) {
        const v0 = grid.values[r][c];
        const v1 = grid.values[r][c + 1];
        if ((v0 - level) * (v1 - level) >= 0) continue;
        const x0 = grid.originX + c * grid.cellSizeM;
        const t = (level - v0) / (v1 - v0);
        const z = grid.originZ + r * grid.cellSizeM;
        rowPts.push([x0 + t * grid.cellSizeM, floorY + 0.05, z]);
      }
      for (let i = 0; i + 1 < rowPts.length; i += 2) {
        segments.push(rowPts[i], rowPts[i + 1]);
      }
    }

    for (let c = 0; c < grid.cols; c++) {
      const colPts: [number, number, number][] = [];
      for (let r = 0; r < grid.rows - 1; r++) {
        const v0 = grid.values[r][c];
        const v1 = grid.values[r + 1][c];
        if ((v0 - level) * (v1 - level) >= 0) continue;
        const z0 = grid.originZ + r * grid.cellSizeM;
        const t = (level - v0) / (v1 - v0);
        const x = grid.originX + c * grid.cellSizeM;
        colPts.push([x, floorY + 0.05, z0 + t * grid.cellSizeM]);
      }
      for (let i = 0; i + 1 < colPts.length; i += 2) {
        segments.push(colPts[i], colPts[i + 1]);
      }
    }

    if (segments.length >= 2) {
      lines.push({ elevationM: level, points: segments });
    }
  }

  return lines;
}

export function parseFloodGrid(raw: unknown, bounds: SiteBounds): FloodGrid | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const size = Number(g.size);
  const depths = g.depths;
  if (!size || !Array.isArray(depths)) return null;

  const cellSizeM = Number(g.cell_size_m) || bounds.spanX / Math.max(size, 1);
  const originX = Number(g.origin_x) ?? bounds.minX;
  const originZ = Number(g.origin_z) ?? bounds.minZ;

  const grid: number[][] = [];
  for (let r = 0; r < depths.length; r++) {
    const row = depths[r];
    if (!Array.isArray(row)) return null;
    grid.push(row.map((v) => Number(v)));
  }
  return { size, cellSizeM, originX, originZ, depths: grid };
}

export function synthesizeFloodGrid(bounds: SiteBounds, floodedAreaM2: number, maxDepthM: number): FloodGrid {
  const size = 32;
  const cellSizeM = bounds.spanX / size;
  const originX = bounds.minX;
  const originZ = bounds.minZ;
  const targetCells = Math.min(
    size * size,
    Math.max(1, Math.round(floodedAreaM2 / (cellSizeM * cellSizeM))),
  );

  const depths: number[][] = [];
  const cx = bounds.centerX;
  const cz = bounds.centerZ;

  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      const x = originX + (c + 0.5) * cellSizeM;
      const z = originZ + (r + 0.5) * cellSizeM;
      const dx = (x - cx) / (bounds.spanX * 0.5);
      const dz = (z - cz) / (bounds.spanZ * 0.5);
      const valley = dx * dx + dz * dz;
      row.push(valley < 0.35 ? maxDepthM * (1 - valley / 0.35) : 0);
    }
    depths.push(row);
  }

  let flooded = 0;
  for (const row of depths) {
    for (const d of row) {
      if (d > 0.01) flooded++;
    }
  }
  if (flooded > targetCells * 1.5 || flooded < targetCells * 0.3) {
    const threshold = maxDepthM * 0.2;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (depths[r][c] < threshold) depths[r][c] = 0;
      }
    }
  }

  return { size, cellSizeM, originX, originZ, depths };
}

export function buildOverlayData(input: GeoOverlayInput): {
  bounds: SiteBounds;
  contours: ContourLine[];
  grid: ElevationGrid | null;
  flood: FloodGrid | null;
} {
  const bounds = resolveSiteBounds(input.floorY, input.platformAreaM2);
  const terrain = input.terrain;
  const floodSummary = input.flood;

  let grid =
    parseElevationGrid(terrain?.elevation_grid, bounds) ??
    (input.showTerrain !== false && terrain
      ? synthesizeElevationGrid(
          bounds,
          Number(terrain.elevation_m) || bounds.floorY,
          Number(terrain.slope_deg) || 2,
        )
      : null);

  let contours = parseContourLines(terrain?.contour_lines, bounds.floorY);
  if (!contours.length && grid && input.showContours !== false) {
    contours = contoursFromGrid(grid, bounds);
  }

  let flood =
    parseFloodGrid(floodSummary?.flood_grid ?? floodSummary, bounds) ??
    (input.showFlood !== false && floodSummary
      ? synthesizeFloodGrid(
          bounds,
          Number(floodSummary.flooded_area_m2) || bounds.spanX * bounds.spanZ * 0.2,
          Number(floodSummary.max_flood_depth_m ?? floodSummary.max_depth_m) || 0.5,
        )
      : null);

  if (input.showFlood === false) flood = null;
  if (input.showContours === false) contours = [];
  if (input.showTerrain === false) grid = null;

  const dx = bounds.centerX;
  const dz = bounds.centerZ;
  if (grid && terrain?.elevation_grid) {
    grid = alignGridToBounds(grid, bounds);
  } else if (grid && (Math.abs(dx) > 1e-6 || Math.abs(dz) > 1e-6)) {
    grid = alignGridToBounds(grid, bounds);
  }
  if (terrain?.contour_lines || terrain?.elevation_grid) {
    contours = shiftContourLines(contours, dx, dz);
  }
  if (flood && (floodSummary?.flood_grid || terrain)) {
    flood = alignGridToBounds(flood, bounds);
  }

  return { bounds, contours, grid, flood };
}

function alignGridToBounds<T extends { originX: number; originZ: number }>(
  grid: T,
  bounds: SiteBounds,
): T {
  const dx = bounds.centerX;
  const dz = bounds.centerZ;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return grid;
  return { ...grid, originX: grid.originX + dx, originZ: grid.originZ + dz };
}

function shiftContourLines(lines: ContourLine[], dx: number, dz: number): ContourLine[] {
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return lines;
  return lines.map((line) => ({
    ...line,
    points: line.points.map((p) => [p[0] + dx, p[1], p[2] + dz] as [number, number, number]),
  }));
}
