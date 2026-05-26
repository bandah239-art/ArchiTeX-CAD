import { occAPI } from '../../services/occAPI';
import type { GeometricEntity } from '../constraints/ConstraintTypes';

export type FeatureType =
  | 'sketch'
  | 'extrude'
  | 'pocket'
  | 'revolve'
  | 'fillet'
  | 'chamfer'
  | 'boolean_union'
  | 'boolean_subtract'
  | 'mirror'
  | 'pattern_linear'
  | 'pattern_circular'
  | 'shell'
  | 'draft';

export interface FeatureInputs {
  entities?: GeometricEntity[];
  sketch_id?: string;
  height?: number;
  base_id?: string;
  depth?: number;
  shape_id?: string;
  radius?: number;
  shape_a_id?: string;
  shape_b_id?: string;
  operation?: 'union' | 'subtract' | 'intersect';
}

export interface OCCShape {
  vertices: number[];
  faces: number[];
  vertex_count: number;
  face_count: number;
  volume?: number;
  area?: number;
  centroid?: { x: number; y: number; z: number };
}

export interface Feature {
  id:           string;
  type:         FeatureType;
  name:         string;
  inputs:       FeatureInputs;
  dependencies: string[];   // feature IDs this depends on
  output:       OCCShape | null;
  status:       'built' | 'needs_rebuild' | 'error';
  error:        string | null;
}

export interface RebuildResult {
  rebuilt: string[];
  failed:  string[];
  skipped: string[];
}

export class FeatureTree {
  private features: Map<string, Feature> = new Map();
  private buildOrder: string[] = [];

  getFeatures(): Feature[] {
    return Array.from(this.features.values());
  }

  getFeature(id: string): Feature | undefined {
    return this.features.get(id);
  }

  addFeature(feature: Feature): void {
    this.features.set(feature.id, feature);
    this.updateBuildOrder();
    this.markDownstreamDirty(feature.id);
  }

  removeFeature(id: string): void {
    this.features.delete(id);
    this.updateBuildOrder();
    // Mark downstream dirty
    this.markDownstreamDirty(id);
  }

  updateFeature(id: string, inputs: Partial<FeatureInputs>): void {
    const feature = this.features.get(id);
    if (!feature) return;
    feature.inputs = { ...feature.inputs, ...inputs };
    feature.status = 'needs_rebuild';
    
    // Recalculate dependencies if sketch_id / parent relations changed
    const deps = new Set<string>();
    if (feature.inputs.sketch_id) deps.add(feature.inputs.sketch_id);
    if (feature.inputs.base_id) deps.add(feature.inputs.base_id);
    if (feature.inputs.shape_id) deps.add(feature.inputs.shape_id);
    if (feature.inputs.shape_a_id) deps.add(feature.inputs.shape_a_id);
    if (feature.inputs.shape_b_id) deps.add(feature.inputs.shape_b_id);
    feature.dependencies = Array.from(deps);

    this.updateBuildOrder();
    this.markDownstreamDirty(id);
  }

  async rebuild(): Promise<RebuildResult> {
    const results: RebuildResult = {
      rebuilt: [],
      failed:  [],
      skipped: []
    };

    // Rebuild in topological order
    for (const id of this.buildOrder) {
      const feature = this.features.get(id);
      if (!feature) continue;

      if (feature.status === 'built') {
        results.skipped.push(id);
        continue;
      }

      try {
        feature.output = await this.buildFeature(feature);
        feature.status = 'built';
        feature.error = null;
        results.rebuilt.push(id);
      } catch (e: any) {
        feature.status = 'error';
        feature.error = e.message || String(e);
        results.failed.push(id);
        // Mark all downstream as error too
        this.markDownstreamError(id, feature.error || "Parent build failed");
      }
    }

    return results;
  }

  private async buildFeature(feature: Feature): Promise<OCCShape> {
    switch (feature.type) {
      case 'sketch': {
        // Return 2D properties + geometry representation
        const entities = feature.inputs.entities || [];
        const res = await occAPI.getProperties(entities);
        return {
          vertices: [],
          faces: [],
          vertex_count: 0,
          face_count: 0,
          area: res.area,
          centroid: res.centroid
        };
      }

      case 'extrude': {
        const sketchId = feature.inputs.sketch_id;
        const sketch = this.features.get(sketchId || '');
        if (!sketch || !sketch.inputs.entities) {
          throw new Error(`Sketch dependency "${sketchId}" is missing or empty`);
        }
        const height = feature.inputs.height ?? 3000;
        const res = await occAPI.extrude(sketch.inputs.entities, height);
        return {
          vertices: res.shape.vertices,
          faces: res.shape.faces,
          vertex_count: res.shape.vertex_count,
          face_count: res.shape.face_count,
          volume: res.volume,
          centroid: res.centroid
        };
      }

      case 'pocket': {
        // A pocket is subtracting extruded profile from a base solid
        const baseId = feature.inputs.base_id;
        const sketchId = feature.inputs.sketch_id;
        const base = this.features.get(baseId || '');
        const sketch = this.features.get(sketchId || '');
        
        if (!base || !base.output) {
          throw new Error(`Base solid dependency "${baseId}" is missing or unbuilt`);
        }
        if (!sketch || !sketch.inputs.entities) {
          throw new Error(`Profile sketch "${sketchId}" is missing or empty`);
        }
        
        const depth = feature.inputs.depth ?? 500;
        // 1. Extrude tool down to create cutter solid
        await occAPI.extrude(sketch.inputs.entities, -depth);
        // 2. Boolean subtract cutter from base using occAPI.boolean helper
        const res = await occAPI.boolean(
          base.inputs.entities || [],
          sketch.inputs.entities,
          'subtract'
        );

        return {
          vertices: res.shape.vertices,
          faces: res.shape.faces,
          vertex_count: res.shape.vertex_count,
          face_count: res.shape.face_count,
          volume: base.output.volume ? Math.max(0, base.output.volume - (sketch.output?.area || 0) * depth) : 0
        };
      }

      case 'fillet': {
        const shapeId = feature.inputs.shape_id;
        const parent = this.features.get(shapeId || '');
        if (!parent || !parent.inputs.entities) {
          throw new Error(`Parent shape dependency "${shapeId}" is missing`);
        }
        const radius = feature.inputs.radius ?? 50;
        if (radius > 1000) {
          throw new Error(`Fillet R=${radius}mm exceeds maximum allowed bounds`);
        }
        const res = await occAPI.addFillet(parent.inputs.entities, radius);
        return {
          vertices: res.shape.vertices,
          faces: res.shape.faces,
          vertex_count: res.shape.vertex_count,
          face_count: res.shape.face_count
        };
      }

      case 'boolean_union': {
        const aId = feature.inputs.shape_a_id;
        const bId = feature.inputs.shape_b_id;
        const a = this.features.get(aId || '');
        const b = this.features.get(bId || '');
        if (!a || !a.inputs.entities || !b || !b.inputs.entities) {
          throw new Error("Boolean union requires two valid inputs");
        }
        const res = await occAPI.boolean(a.inputs.entities, b.inputs.entities, 'union');
        return {
          vertices: res.shape.vertices,
          faces: res.shape.faces,
          vertex_count: res.shape.vertex_count,
          face_count: res.shape.face_count,
          area: res.area
        };
      }

      default:
        throw new Error(`Unhandled feature type: ${feature.type}`);
    }
  }

  private markDownstreamDirty(id: string): void {
    for (const [fId, feature] of this.features) {
      if (feature.dependencies.includes(id)) {
        feature.status = 'needs_rebuild';
        this.markDownstreamDirty(fId);
      }
    }
  }

  private markDownstreamError(id: string, errMsg: string): void {
    for (const [fId, feature] of this.features) {
      if (feature.dependencies.includes(id)) {
        feature.status = 'error';
        feature.error = `Dependency failed: ${errMsg}`;
        this.markDownstreamError(fId, errMsg);
      }
    }
  }

  private updateBuildOrder(): void {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: string[] = [];

    const visit = (id: string) => {
      if (temp.has(id)) {
        throw new Error("Circular dependency detected in history tree");
      }
      if (visited.has(id)) return;
      
      temp.add(id);
      const feature = this.features.get(id);
      if (feature) {
        for (const dep of feature.dependencies) {
          visit(dep);
        }
      }
      temp.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of this.features.keys()) {
      visit(id);
    }

    this.buildOrder = order;
  }
}
