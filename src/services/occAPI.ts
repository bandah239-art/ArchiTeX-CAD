import type { GeometricEntity } from '../cad/constraints/ConstraintTypes';
import { API_BASE } from './apiConfig';

const OCC_BASE = `${API_BASE}/occ`;

export const occAPI = {
  async getProperties(entities: GeometricEntity[]) {
    const res = await fetch(`${OCC_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entities: entities.map(e => ({ type: e.type, params: e.params }))
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async offsetProfile(
    entities: GeometricEntity[],
    distance: number,
    joinType: 'arc' | 'intersection' = 'arc'
  ) {
    const res = await fetch(`${OCC_BASE}/offset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entities: entities.map(e => ({ type: e.type, params: e.params })),
        offset_distance: distance,
        join_type: joinType
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async addFillet(
    entities: GeometricEntity[],
    radius: number,
    vertexIndices?: number[]
  ) {
    const res = await fetch(`${OCC_BASE}/fillet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entities: entities.map(e => ({ type: e.type, params: e.params })),
        radius,
        vertex_indices: vertexIndices ?? null
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async extrude(
    entities: GeometricEntity[],
    height: number
  ) {
    const res = await fetch(`${OCC_BASE}/extrude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entities: entities.map(e => ({ type: e.type, params: e.params })),
        height
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async boolean(
    entitiesA: GeometricEntity[],
    entitiesB: GeometricEntity[],
    operation: 'union' | 'subtract' | 'intersect'
  ) {
    const res = await fetch(`${OCC_BASE}/boolean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entities_a: entitiesA.map(e => ({ type: e.type, params: e.params })),
        entities_b: entitiesB.map(e => ({ type: e.type, params: e.params })),
        operation
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async exportSTEP(
    entities: GeometricEntity[],
    height: number
  ) {
    const res = await fetch(`${OCC_BASE}/export/step`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entities: entities.map(e => ({ type: e.type, params: e.params })),
        height
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.step';
    a.click();
    URL.revokeObjectURL(url);
  }
};
