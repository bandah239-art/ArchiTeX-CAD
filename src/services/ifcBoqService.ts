import type { IFCElement } from '../types/ifc';

/** Representative residential BIM elements when viewer geometry is unavailable. */
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
  loadedModel: { elementCount: number } | null,
  selectedElement: IFCElement | null
): IFCElement[] {
  if (selectedElement?.type?.startsWith('Ifc')) {
    return [selectedElement];
  }
  if (loadedModel && loadedModel.elementCount > 0) {
    return sampleBimElements();
  }
  return sampleBimElements();
}
