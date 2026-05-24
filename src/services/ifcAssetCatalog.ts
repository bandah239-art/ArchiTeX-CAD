import type { ParsedIfcElement } from './ifcParser';

export interface AssetCategory {
  type: string;
  label: string;
  count: number;
  totalVolume: number;
  totalArea: number;
  entityIds: string[];
  color: string;
  icon: 'wall' | 'slab' | 'column' | 'beam' | 'opening' | 'roof' | 'generic';
}

const TYPE_COLORS: Record<string, string> = {
  IfcWall: '#75b798',
  IfcSlab: '#8a8a90',
  IfcBeam: '#7290b8',
  IfcColumn: '#9e7a6b',
  IfcFooting: '#807870',
  IfcDoor: '#8c5a33',
  IfcWindow: '#99bfd9',
  IfcRoof: '#a64d40',
  IfcStair: '#808084',
  IfcRailing: '#6a8a6a',
  IfcCovering: '#7a7a82',
  IfcPlate: '#888890',
  IfcMember: '#708090',
};

const TYPE_ICONS: Record<string, AssetCategory['icon']> = {
  IfcWall: 'wall',
  IfcSlab: 'slab',
  IfcColumn: 'column',
  IfcBeam: 'beam',
  IfcDoor: 'opening',
  IfcWindow: 'opening',
  IfcRoof: 'roof',
};

function iconForType(type: string): AssetCategory['icon'] {
  return TYPE_ICONS[type] ?? 'generic';
}

function colorForType(type: string, index: number): string {
  if (TYPE_COLORS[type]) return TYPE_COLORS[type];
  const hue = (index * 47) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

export function buildAssetCatalog(
  elements: ParsedIfcElement[],
  elementByEntityId: Map<string, ParsedIfcElement>
): AssetCategory[] {
  const byType = new Map<string, { elements: ParsedIfcElement[]; entityIds: string[] }>();

  for (const el of elements) {
    if (!el.meshBuffers.length) continue;
    const bucket = byType.get(el.type) ?? { elements: [], entityIds: [] };
    bucket.elements.push(el);
    byType.set(el.type, bucket);
  }

  for (const [entityId, el] of elementByEntityId) {
    const bucket = byType.get(el.type);
    if (bucket && !bucket.entityIds.includes(entityId)) {
      bucket.entityIds.push(entityId);
    }
  }

  let colorIndex = 0;
  return Array.from(byType.entries())
    .map(([type, { elements: els, entityIds }]) => ({
      type,
      label: type.replace(/^Ifc/, ''),
      count: els.length,
      totalVolume: els.reduce((s, e) => s + (e.volume ?? 0), 0),
      totalArea: els.reduce((s, e) => s + (e.area ?? 0), 0),
      entityIds,
      color: colorForType(type, colorIndex++),
      icon: iconForType(type),
    }))
    .sort((a, b) => b.count - a.count);
}

export function modelTotals(catalog: AssetCategory[]) {
  return {
    elementCount: catalog.reduce((s, c) => s + c.count, 0),
    totalVolume: catalog.reduce((s, c) => s + c.totalVolume, 0),
    totalArea: catalog.reduce((s, c) => s + c.totalArea, 0),
    typeCount: catalog.length,
  };
}
