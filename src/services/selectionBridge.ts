import type { IFCElement } from '../types/ifc';
import { useIfcModelStore } from '../store/ifcModelStore';
import { entityIdFromExpressId } from './ifcMeshXeokit';
import { useDrawStore } from '../store/drawStore';
import type { SiteBounds } from './geoOverlayUtils';

export const OVERLAY_LAYER_IDS = ['sketchLayer', 'geoOverlay', 'measure'] as const;
export type OverlayLayerId = (typeof OVERLAY_LAYER_IDS)[number];

const SKIP_PREFIXES = ['sketchLayer', 'geoOverlay', 'measure', 'sketchWorkspace', 'annot-'];

export function isOverlayEntityId(entityId: string): boolean {
  return SKIP_PREFIXES.some((p) => entityId.startsWith(p));
}

/** Normalize marquee / pick ids to xeokit entity ids (`ifc-{expressId}`). */
export function normalizeEntityId(raw: string): string | null {
  if (!raw || isOverlayEntityId(raw)) return null;
  const map = useIfcModelStore.getState().elementByEntityId;
  if (map.has(raw)) return raw;

  const ifcPrefixed = entityIdFromExpressId(raw);
  if (map.has(ifcPrefixed)) return ifcPrefixed;

  const numeric = raw.replace(/^ifc-/, '');
  if (/^\d+$/.test(numeric)) {
    const id = entityIdFromExpressId(numeric);
    if (map.has(id)) return id;
  }
  return null;
}

export function resolveIfcElement(entityId: string): IFCElement | null {
  const normalized = normalizeEntityId(entityId);
  if (!normalized) return null;
  return useIfcModelStore.getState().getElementByEntityId(normalized);
}

export function resolveIfcElements(rawIds: string[]): IFCElement[] {
  const seen = new Set<string>();
  const out: IFCElement[] = [];
  for (const raw of rawIds) {
    const normalized = normalizeEntityId(raw);
    if (!normalized || seen.has(normalized)) continue;
    const el = useIfcModelStore.getState().getElementByEntityId(normalized);
    if (!el) continue;
    seen.add(normalized);
    out.push(el);
  }
  return out;
}

/** IFC mesh bounds (Z-up) → xeokit site footprint (X/Z horizontal). */
export function modelBoundsToSiteFootprint(
  bounds: { min: number[]; max: number[] },
): Pick<SiteBounds, 'minX' | 'maxX' | 'minZ' | 'maxZ'> {
  const [minX, minY] = bounds.min;
  const [maxX, maxY] = bounds.max;
  return {
    minX,
    maxX,
    minZ: -maxY,
    maxZ: -minY,
  };
}

function boundsFromSiteBoundary(floorY: number): SiteBounds | null {
  const boundary = useDrawStore.getState().elements.find((e) => e.kind === 'site-boundary');
  if (!boundary || boundary.points.length < 3) return null;
  const xs = boundary.points.map((p) => p.x);
  const zs = boundary.points.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    spanX: Math.max(maxX - minX, 10),
    spanZ: Math.max(maxZ - minZ, 10),
    floorY,
  };
}

function unionBounds(a: SiteBounds, b: Pick<SiteBounds, 'minX' | 'maxX' | 'minZ' | 'maxZ'>): SiteBounds {
  const minX = Math.min(a.minX, b.minX);
  const maxX = Math.max(a.maxX, b.maxX);
  const minZ = Math.min(a.minZ, b.minZ);
  const maxZ = Math.max(a.maxZ, b.maxZ);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    spanX: Math.max(maxX - minX, 10),
    spanZ: Math.max(maxZ - minZ, 10),
    floorY: a.floorY,
  };
}

/** Site boundary + model AABB + platform area fallback — shared geo/RE context. */
export function resolveSiteBounds(floorY: number, platformAreaM2 = 400): SiteBounds {
  const fromBoundary = boundsFromSiteBoundary(floorY);
  const stats = useIfcModelStore.getState().stats;
  const modelFoot =
    stats?.bounds &&
    Number.isFinite(stats.bounds.min[0]) &&
    (stats.bounds.max[0] !== stats.bounds.min[0] || stats.bounds.max[1] !== stats.bounds.min[1])
      ? modelBoundsToSiteFootprint(stats.bounds)
      : null;

  if (fromBoundary && modelFoot) return unionBounds(fromBoundary, modelFoot);
  if (fromBoundary) return fromBoundary;
  if (modelFoot) {
    return {
      ...modelFoot,
      centerX: (modelFoot.minX + modelFoot.maxX) / 2,
      centerZ: (modelFoot.minZ + modelFoot.maxZ) / 2,
      spanX: Math.max(modelFoot.maxX - modelFoot.minX, 10),
      spanZ: Math.max(modelFoot.maxZ - modelFoot.minZ, 10),
      floorY,
    };
  }

  const side = Math.sqrt(Math.max(platformAreaM2, 100));
  const half = side / 2;
  return {
    minX: -half,
    maxX: half,
    minZ: -half,
    maxZ: half,
    centerX: 0,
    centerZ: 0,
    spanX: side,
    spanZ: side,
    floorY,
  };
}

const CALC_MODULE_BY_IFC: Record<string, 'beam' | 'slab' | 'column' | 'foundation'> = {
  IfcBeam: 'beam',
  IfcSlab: 'slab',
  IfcColumn: 'column',
  IfcFooting: 'foundation',
  IfcFoundation: 'foundation',
};

export function calcModuleForIfcType(type: string): 'beam' | 'slab' | 'column' | 'foundation' | null {
  return CALC_MODULE_BY_IFC[type] ?? null;
}

export type FieldConfidence = 'high' | 'medium' | 'low';

/** Convert metres → mm when value looks like IFC metres (< 3 m). */
function toMm(value: number | undefined, fallbackMm: number): { value: number; confidence: FieldConfidence } {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return { value: fallbackMm, confidence: 'low' };
  }
  if (value < 3) {
    return { value: Math.round(value * 1000), confidence: 'high' };
  }
  if (value < 30) {
    return { value: Math.round(value * 1000), confidence: 'medium' };
  }
  return { value: Math.round(value), confidence: 'high' };
}

function toMetres(value: number | undefined, fallbackM: number): { value: number; confidence: FieldConfidence } {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return { value: fallbackM, confidence: 'low' };
  }
  if (value > 100) {
    return { value: value / 1000, confidence: 'medium' };
  }
  return { value, confidence: 'high' };
}

export interface CalcPrefillResult {
  module: 'beam' | 'slab' | 'column' | 'foundation';
  element: IFCElement;
  inputs: Record<string, unknown>;
  confidence: FieldConfidence;
  confidenceNote: string;
  fieldConfidence: Record<string, FieldConfidence>;
}

export function calcPrefillFromElement(el: IFCElement): CalcPrefillResult {
  const module = calcModuleForIfcType(el.type)!;
  const fieldConfidence: Record<string, FieldConfidence> = {};
  const inputs: Record<string, unknown> = {};

  const spanM = toMetres(el.length, 6);
  const widthMm = toMm(el.width, 300);
  const depthMm = toMm(el.height, 500);

  switch (el.type) {
    case 'IfcBeam':
      inputs.span = spanM.value;
      inputs.width = widthMm.value;
      inputs.depth = depthMm.value;
      fieldConfidence.span = spanM.confidence;
      fieldConfidence.width = widthMm.confidence;
      fieldConfidence.depth = depthMm.confidence;
      break;
    case 'IfcSlab': {
      const ly = toMetres(el.width, spanM.value);
      inputs.span_lx = spanM.value;
      inputs.span_ly = ly.value;
      inputs.depth = depthMm.value < 10 ? 175 : depthMm.value;
      fieldConfidence.span_lx = spanM.confidence;
      fieldConfidence.span_ly = ly.confidence;
      fieldConfidence.depth = depthMm.confidence;
      break;
    }
    case 'IfcColumn':
      inputs.height = spanM.value;
      inputs.width = widthMm.value;
      inputs.depth = depthMm.value;
      fieldConfidence.height = spanM.confidence;
      fieldConfidence.width = widthMm.confidence;
      fieldConfidence.depth = depthMm.confidence;
      break;
    case 'IfcFooting':
    case 'IfcFoundation': {
      const fw = toMetres(el.width, 2.4);
      inputs.foundation_width = fw.value;
      inputs.foundation_length = spanM.value;
      inputs.foundation_depth_concrete = depthMm.value;
      fieldConfidence.foundation_width = fw.confidence;
      fieldConfidence.foundation_length = spanM.confidence;
      fieldConfidence.foundation_depth_concrete = depthMm.confidence;
      break;
    }
  }

  const levels = Object.values(fieldConfidence);
  const lowCount = levels.filter((c) => c === 'low').length;
  const confidence: FieldConfidence =
    lowCount === 0 ? 'high' : lowCount <= 1 ? 'medium' : 'low';
  const confidenceNote =
    confidence === 'high'
      ? 'Dimensions from IFC geometry — verify before design'
      : confidence === 'medium'
        ? 'Some dimensions estimated — check in inspector'
        : 'Missing IFC data — manual entry required';

  return { module, element: el, inputs, confidence, confidenceNote, fieldConfidence };
}

/** @deprecated Use calcPrefillFromElement for confidence metadata. */
export function calcInputsFromElement(el: IFCElement): Record<string, unknown> {
  return calcPrefillFromElement(el).inputs;
}
