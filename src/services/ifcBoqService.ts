import type { IFCElement } from '../types/ifc';
import type { ParsedIfcElement } from './ifcParser';
import { mergePlacedMeshes, quantitiesFromMesh } from './ifcQuantities';

/** Representative residential BIM elements when no geometry is available. */
export function sampleBimElements(): IFCElement[] {
  return [
    { id: '1', globalId: 'W-001', type: 'IfcWall', name: 'External Wall North', length: 12, width: 0.23, height: 2.8 },
    { id: '2', globalId: 'W-002', type: 'IfcWall', name: 'External Wall South', length: 12, width: 0.23, height: 2.8 },
    { id: '3', globalId: 'S-001', type: 'IfcSlab', name: 'Ground Floor Slab', length: 10, width: 8, height: 0.175, area: 80 },
    { id: '4', globalId: 'C-001', type: 'IfcColumn', name: 'Column C1', length: 3.5, width: 0.3, height: 0.3 },
    { id: '5', globalId: 'F-001', type: 'IfcFooting', name: 'Pad Footing F1', length: 2.4, width: 2.4, height: 0.45 },
    { id: '6', globalId: 'B-001', type: 'IfcBeam', name: 'Beam B1', length: 6, width: 0.3, height: 0.5 },
    { id: '7', globalId: 'R-001', type: 'IfcRoof', name: 'Main Roof', length: 12, width: 10, area: 120 },
  ];
}

export function designBriefToBimPayload(brief: Record<string, unknown>): Record<string, unknown>[] {
  const gfa = Number(brief.gross_floor_area ?? 100);
  const spaces = (brief.spatial_programme as { space: string; area_m2: number }[]) ?? [];
  const side = Math.sqrt(gfa);

  const elements: Record<string, unknown>[] = spaces.map((s, i) => ({
    id: String(i + 1),
    globalId: `AI-S-${i + 1}`,
    type: 'IfcSlab',
    name: s.space,
    area: s.area_m2,
    length: Math.sqrt(s.area_m2),
    width: Math.sqrt(s.area_m2),
    height: 0.175,
  }));

  elements.push(
    {
      id: 'w1',
      globalId: 'AI-W-N',
      type: 'IfcWall',
      name: 'External wall north',
      length: side,
      width: 0.23,
      height: 2.8,
    },
    {
      id: 'w2',
      globalId: 'AI-W-S',
      type: 'IfcWall',
      name: 'External wall south',
      length: side,
      width: 0.23,
      height: 2.8,
    },
    {
      id: 'f1',
      globalId: 'AI-F-1',
      type: 'IfcFooting',
      name: 'Pad footing',
      length: 2.4,
      width: 2.4,
      height: 0.45,
    },
    {
      id: 'r1',
      globalId: 'AI-R-1',
      type: 'IfcRoof',
      name: 'Main roof',
      area: gfa * 1.1,
      length: side,
      width: side,
    }
  );

  return elements;
}

export function toBimPayload(elements: IFCElement[]): Record<string, unknown>[] {
  return elements.map((el) => ({
    id: el.id,
    globalId: el.globalId,
    type: el.type,
    name: el.name,
    length: el.length,
    width: el.width,
    height: el.height,
    volume: el.volume,
    area: el.area,
    properties: el.properties ?? {},
  }));
}

export function elementsFromViewer(
  parsedElements: IFCElement[] | null,
  selectedElement: IFCElement | null
): IFCElement[] {
  if (selectedElement && (selectedElement.volume || selectedElement.area || selectedElement.length)) {
    return [selectedElement];
  }
  if (parsedElements?.length) {
    return parsedElements.filter((e) => e.volume || e.area || e.length);
  }
  if (selectedElement?.type?.startsWith('Ifc')) {
    return [selectedElement];
  }
  return sampleBimElements();
}

/** Build element list with AABB bounds for model-wide clash scan. */
export function buildClashScanPayload(elements: ParsedIfcElement[]): Record<string, unknown>[] {
  return elements
    .filter((el) => el.meshBuffers.length > 0)
    .map((el) => {
      const merged = mergePlacedMeshes(el.meshBuffers);
      const geom = quantitiesFromMesh(merged);
      return {
        id: el.id,
        globalId: el.globalId,
        type: el.type,
        name: el.name,
        bounds: {
          min: [...geom.bounds.min],
          max: [...geom.bounds.max],
        },
      };
    });
}
