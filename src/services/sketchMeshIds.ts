import type { SketchElement } from '../store/drawStore';
import { isClosedRing } from './sketchGeometry';
import { SKETCH_LAYER_PREFIX } from './transformGizmo';

const LAYER = SKETCH_LAYER_PREFIX;

function outlineEdgeCount(el: SketchElement): number {
  if (el.points.length < 2) return 0;
  if (el.kind === 'site-boundary') {
    return el.points.length >= 3 ? el.points.length : el.points.length - 1;
  }
  if (el.kind === 'slab' || el.kind === 'rectangle' || el.kind === 'polygon') {
    return isClosedRing(el.points) ? el.points.length - 1 : el.points.length;
  }
  return 0;
}

/** All scene entity ids used to render one sketch element (for highlight/select). */
export function sketchMeshIdsForElement(el: SketchElement): string[] {
  const ids = new Set<string>([`${LAYER}-${el.id}`]);

  switch (el.kind) {
    case 'slab':
    case 'rectangle':
    case 'polygon':
      ids.add(`${LAYER}-${el.id}-fill`);
      if (el.kind === 'slab') {
        const loop = isClosedRing(el.points) ? el.points : [...el.points, el.points[0]];
        for (let i = 0; i < loop.length - 1; i++) {
          ids.add(`${LAYER}-${el.id}-skirt-${i}`);
        }
      }
      break;
    case 'site-boundary':
      break;
    case 'column':
      break;
    default:
      for (let i = 0; i < Math.max(0, el.points.length - 1); i++) {
        ids.add(`${LAYER}-${el.id}-${i}`);
      }
      break;
  }

  const edges = outlineEdgeCount(el);
  for (let i = 0; i < edges; i++) {
    ids.add(`${LAYER}-${el.id}-edge-${i}`);
  }

  const vertCount =
    el.kind === 'site-boundary' || el.kind === 'slab' || el.kind === 'rectangle' || el.kind === 'polygon'
      ? isClosedRing(el.points)
        ? el.points.length - 1
        : el.points.length
      : el.points.length;
  for (let i = 0; i < vertCount; i++) {
    ids.add(`${LAYER}-${el.id}-v-${i}`);
  }

  return [...ids];
}
