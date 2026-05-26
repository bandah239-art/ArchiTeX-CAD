import type { Viewer } from '@xeokit/xeokit-sdk';

export interface ProceduralPayload {
  type: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    radius?: number;
  };
  position?: {
    x?: number;
    y?: number;
    z?: number;
  };
}

let objectCounter = 0;

export function buildProceduralObject(viewer: Viewer | null, payload: ProceduralPayload): boolean {
  if (!viewer) return false;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneModel = viewer.scene.models['ifcModel'] as any;
  if (!sceneModel) {
    console.warn('No active scene model found to add procedural object.');
    return false;
  }

  const { type, dimensions = {}, position = {} } = payload;
  
  // Default dimensions
  const l = dimensions.length || 1;
  const w = dimensions.width || 1;
  const h = dimensions.height || 1;
  const r = dimensions.radius || 0.5;

  // Default positions
  const px = position.x || 0;
  const py = position.y || 0;
  const pz = position.z || 0;

  objectCounter++;
  const geometryId = `procedural-geom-${objectCounter}`;
  const meshId = `procedural-mesh-${objectCounter}`;
  const entityId = `ifc-procedural-${objectCounter}`;

  try {
    // 1. Create Geometry
    if (type === 'rod' || type === 'cylinder' || type === 'column') {
      // Basic approximation of a cylinder using a box for now, or you can build a cylinder primitive
      createBoxGeometry(sceneModel, geometryId, r * 2, h, r * 2);
    } else if (type === 'sphere') {
      createBoxGeometry(sceneModel, geometryId, r*2, r*2, r*2); // fallback
    } else {
      // Default to box (wall, slab, box)
      createBoxGeometry(sceneModel, geometryId, l, h, w);
    }

    // 2. Create Mesh
    sceneModel.createMesh({
      id: meshId,
      geometryId,
      primitive: 'triangles',
      matrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        px, py, pz, 1
      ],
      color: [0.3, 0.6, 0.9],
      opacity: 1,
    } as any);

    // 3. Create Entity
    sceneModel.createEntity({
      id: entityId,
      meshIds: [meshId],
      isObject: true,
    });

    sceneModel.finalize();
    return true;
  } catch (error) {
    console.error('Error building procedural object:', error);
    return false;
  }
}

function createBoxGeometry(sceneModel: any, id: string, xSize: number, ySize: number, zSize: number) {
  const hx = xSize / 2;
  const hy = ySize / 2;
  const hz = zSize / 2;

  const positions = [
    // Front face
    -hx, -hy,  hz,
     hx, -hy,  hz,
     hx,  hy,  hz,
    -hx,  hy,  hz,
    // Back face
    -hx, -hy, -hz,
    -hx,  hy, -hz,
     hx,  hy, -hz,
     hx, -hy, -hz,
    // Top face
    -hx,  hy, -hz,
    -hx,  hy,  hz,
     hx,  hy,  hz,
     hx,  hy, -hz,
    // Bottom face
    -hx, -hy, -hz,
     hx, -hy, -hz,
     hx, -hy,  hz,
    -hx, -hy,  hz,
    // Right face
     hx, -hy, -hz,
     hx,  hy, -hz,
     hx,  hy,  hz,
     hx, -hy,  hz,
    // Left face
    -hx, -hy, -hz,
    -hx, -hy,  hz,
    -hx,  hy,  hz,
    -hx,  hy, -hz
  ];

  const indices = [
    0, 1, 2,      0, 2, 3,    // front
    4, 5, 6,      4, 6, 7,    // back
    8, 9, 10,     8, 10, 11,  // top
    12, 13, 14,   12, 14, 15, // bottom
    16, 17, 18,   16, 18, 19, // right
    20, 21, 22,   20, 22, 23  // left
  ];

  sceneModel.createGeometry({
    id,
    primitive: 'triangles',
    positions,
    indices,
  });
}
