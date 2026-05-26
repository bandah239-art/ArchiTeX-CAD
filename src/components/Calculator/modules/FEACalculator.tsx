import { MeshViewer } from '../../FEA/MeshViewer';

export function FEACalculator() {
  const mockNodes = [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 10, y: 0 },
    { id: 3, x: 10, y: 10 },
    { id: 4, x: 0, y: 10 },
  ];

  const mockElements = [
    { id: 1, node_i: 1, node_j: 2 },
    { id: 2, node_i: 2, node_j: 3 },
    { id: 3, node_i: 3, node_j: 4 },
    { id: 4, node_i: 4, node_j: 1 },
    { id: 5, node_i: 1, node_j: 3 },
  ];

  const mockDisplacements = [
    { node_id: 1, ux: 0, uy: 0 },
    { node_id: 2, ux: 0.1, uy: -0.05 },
    { node_id: 3, ux: 0.2, uy: -0.1 },
    { node_id: 4, ux: 0.15, uy: 0 },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-4 space-y-6">
      <div className="bg-infra-bg border border-infra-accent/30 rounded-lg p-4">
        <h3 className="text-infra-highlight font-bold mb-4 uppercase">Finite Element Analysis (FEA)</h3>
        <p className="text-sm text-gray-300 mb-6">
          Direct Stiffness Method solver preview. Showing undeformed mesh (gray) and simulated deformed mesh (green).
        </p>
        <MeshViewer 
          nodes={mockNodes} 
          elements={mockElements} 
          displacements={mockDisplacements} 
          scale={20} 
        />
      </div>
    </div>
  );
}
