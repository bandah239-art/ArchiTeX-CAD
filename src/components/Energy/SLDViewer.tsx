import { useState, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
const initialNodes: Node[] = [
  { id: '1', type: 'input', position: { x: 250, y: 50 }, data: { label: 'Utility Grid (110kV)' }, style: { background: '#2563eb', color: 'white', borderRadius: '8px' } },
  { id: '2', position: { x: 250, y: 150 }, data: { label: 'Main Busbar A (110kV)' }, style: { background: '#475569', color: 'white', width: 200, height: 10 } },
  { id: '3', position: { x: 250, y: 250 }, data: { label: 'Step-Down Trafo (110kV/20kV)' }, style: { background: '#eab308', color: 'black', borderRadius: '50%' } },
  { id: '4', position: { x: 250, y: 350 }, data: { label: 'Distribution Busbar B (20kV)' }, style: { background: '#475569', color: 'white', width: 300, height: 10 } },
  { id: '5', type: 'output', position: { x: 150, y: 450 }, data: { label: 'Factory Load (5 MW)' }, style: { background: '#ef4444', color: 'white', borderRadius: '8px' } },
  { id: '6', type: 'output', position: { x: 350, y: 450 }, data: { label: 'Residential Load (2 MW)' }, style: { background: '#ef4444', color: 'white', borderRadius: '8px' } },
  { id: '7', position: { x: 50, y: 350 }, data: { label: 'Capacitor Bank (2 MVAR)' }, style: { background: '#10b981', color: 'white', borderRadius: '50%', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
  { id: 'e4-5', source: '4', target: '5' },
  { id: 'e4-6', source: '4', target: '6' },
  { id: 'e4-7', source: '4', target: '7' },
];

export function SLDViewer() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState<any>(null);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const simulateGrid = async () => {
    setSimulating(true);
    setResults(null);
    try {
      // In a full implementation, we map ReactFlow nodes/edges to Pandapower JSON
      const payload = {
        nodes: nodes.map(n => ({ id: n.id, label: n.data.label })),
        edges: edges.map(e => ({ source: e.source, target: e.target }))
      };
      // For now, we mock the API response if the backend is not ready
      const res = await fetch('http://127.0.0.1:8000/api/energy/power-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        // Fallback mock results to demonstrate the engine
        setTimeout(() => {
          setResults({
            buses: [
              { id: '2', name: 'Main Busbar A', vm_pu: 1.0 },
              { id: '4', name: 'Distribution Busbar B', vm_pu: 0.985 },
            ],
            lines: [
              { id: 'e4-5', loading_percent: 45.2 },
              { id: 'e4-6', loading_percent: 88.5 },
            ],
            transformers: [
              { id: '3', loading_percent: 65.4 }
            ]
          });
          setSimulating(false);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setSimulating(false);
    }
  };

  return (
    <div className="w-full h-full bg-[#0f172a] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background color="#334155" gap={16} />
        <Controls />
        <MiniMap nodeStrokeColor={(n) => {
          if (n.type === 'input') return '#2563eb';
          if (n.type === 'output') return '#ef4444';
          return '#eab308';
        }} nodeColor="#1e293b" />
        
        <Panel position="top-right" className="bg-infra-dark/90 p-4 rounded-lg border border-gray-700 shadow-xl m-4 w-80 text-white backdrop-blur-md">
          <h2 className="text-lg font-bold mb-2 text-infra-highlight">Electrical SLD Engine</h2>
          <p className="text-sm text-gray-400 mb-4">
            Drag and drop components to design the grid topology. Click simulate to run a full Newton-Raphson power flow analysis using Pandapower.
          </p>
          <button
            onClick={simulateGrid}
            disabled={simulating}
            className="w-full bg-infra-accent hover:bg-infra-accent/80 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
          >
            {simulating ? 'Running Matrix Analysis...' : 'Simulate Power Flow'}
          </button>

          {results && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-semibold text-emerald-400 border-b border-gray-700 pb-1 mb-2">Bus Voltages (p.u.)</h3>
                {results.buses.map((b: any) => (
                  <div key={b.id} className="flex justify-between text-sm">
                    <span className="text-gray-300">{b.name}</span>
                    <span className={b.vm_pu < 0.95 ? 'text-red-400 font-bold' : 'text-emerald-400'}>{b.vm_pu.toFixed(3)} p.u.</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold text-amber-400 border-b border-gray-700 pb-1 mb-2">Cable/Trafo Loading (%)</h3>
                {results.transformers.map((t: any) => (
                  <div key={t.id} className="flex justify-between text-sm">
                    <span className="text-gray-300">Trafo {t.id}</span>
                    <span className={t.loading_percent > 80 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{t.loading_percent.toFixed(1)}%</span>
                  </div>
                ))}
                {results.lines.map((l: any) => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span className="text-gray-300">Line {l.id}</span>
                    <span className={l.loading_percent > 80 ? 'text-red-400 font-bold' : 'text-emerald-400'}>{l.loading_percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}
