import { useState, useCallback, useRef } from 'react';
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
  ReactFlowInstance,
  NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCalculationStore } from '../../store/calculationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { CalculationModule } from '../../types/calculations';

// ── Component palette definitions ────────────────────────────────────────────

interface PaletteItem {
  type: string;
  label: string;
  icon: string;
  color: string;
  calcModule?: CalculationModule;
  calcLabel?: string;
  defaultData: Record<string, string | number>;
}

const PALETTE: PaletteItem[] = [
  { type: 'grid',        label: 'Utility Grid',      icon: '🏭', color: '#3b82f6', defaultData: { voltage: '33kV', label: 'Utility Grid' } },
  { type: 'transformer', label: 'Transformer',        icon: '⚡', color: '#eab308', calcModule: 'energy_transmission', calcLabel: 'Sag-Tension / Sizing', defaultData: { rating: '315 kVA', ratio: '33kV/415V', label: 'Transformer' } },
  { type: 'generator',   label: 'Generator',          icon: '🔋', color: '#10b981', calcModule: 'energy_bess',         calcLabel: 'Solar & BESS Sizing',   defaultData: { rating: '200 kW', label: 'Generator' } },
  { type: 'busbar',      label: 'Busbar',             icon: '━━', color: '#64748b', defaultData: { voltage: '415V', label: 'Main LV Busbar' } },
  { type: 'breaker',     label: 'Circuit Breaker',    icon: '⊟',  color: '#94a3b8', calcModule: 'energy_grid_fault',   calcLabel: 'Fault Analysis',        defaultData: { rating: '630A', label: 'ACB' } },
  { type: 'solar',       label: 'Solar PV',           icon: '☀️', color: '#f59e0b', calcModule: 'energy_bess',         calcLabel: 'Solar & BESS Sizing',   defaultData: { power_kw: 100, label: 'PV Array' } },
  { type: 'battery',     label: 'Battery Storage',    icon: '🔋', color: '#8b5cf6', calcModule: 'energy_bess',         calcLabel: 'BESS Sizing',           defaultData: { capacity_kwh: 200, label: 'BESS' } },
  { type: 'motor',       label: 'Motor / Load',       icon: '⚙',  color: '#ef4444', calcModule: 'energy_microgrid',    calcLabel: 'Cable & Load Sizing',   defaultData: { power_kw: 55, label: 'Motor Load' } },
  { type: 'capacitor',   label: 'Capacitor Bank',     icon: '⊙',  color: '#06b6d4', defaultData: { rating: '150 kVAR', label: 'Cap Bank' } },
  { type: 'load',        label: 'General Load',       icon: '💡', color: '#f97316', calcModule: 'energy_microgrid',    calcLabel: 'Cable Sizing',          defaultData: { power_kw: 20, label: 'Load' } },
];

// ── Custom node component ─────────────────────────────────────────────────────

function SLDNode({ data, selected }: NodeProps) {
  const d = data as { label: string; icon: string; color: string; type: string; calcModule?: string; calcLabel?: string; [k: string]: unknown };

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[110px] cursor-default
        border-2 transition-all ${selected ? 'border-white shadow-lg shadow-white/20' : 'border-transparent'}`}
      style={{ background: `${d.color}22`, borderColor: selected ? '#fff' : d.color }}
      title={d.calcLabel ? `Double-click: ${d.calcLabel}` : d.label}
    >
      <Handle type="target" position={Position.Top}    className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="target" position={Position.Left}   className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Right}  className="!bg-gray-400 !w-2 !h-2" />

      <span className="text-xl leading-none mb-1">{d.icon as string}</span>
      <span className="text-[11px] font-bold text-white text-center leading-tight">{d.label as string}</span>
      {d.type === 'busbar' && (
        <div className="absolute inset-x-0 top-1/2 h-1.5 rounded" style={{ background: d.color, opacity: 0.8 }} />
      )}
      {d.calcModule && (
        <span className="text-[8px] text-gray-400 mt-0.5">↕ calc</span>
      )}
    </div>
  );
}

const NODE_TYPES = { sld: SLDNode };

// ── Default starter diagram ───────────────────────────────────────────────────

const STARTER_NODES: Node[] = [
  { id: 'n1', type: 'sld', position: { x: 300, y:  40 }, data: { ...PALETTE[0].defaultData, icon: PALETTE[0].icon, color: PALETTE[0].color, type: 'grid' } },
  { id: 'n2', type: 'sld', position: { x: 300, y: 160 }, data: { ...PALETTE[1].defaultData, icon: PALETTE[1].icon, color: PALETTE[1].color, type: 'transformer', calcModule: 'energy_transmission', calcLabel: 'Sag-Tension / Sizing' } },
  { id: 'n3', type: 'sld', position: { x: 300, y: 300 }, data: { label: 'Main LV Busbar', icon: '━━', color: '#64748b', type: 'busbar' } },
  { id: 'n4', type: 'sld', position: { x: 160, y: 420 }, data: { label: 'Factory Load', icon: '⚙', color: '#ef4444', type: 'motor', power_kw: 55, calcModule: 'energy_microgrid', calcLabel: 'Cable & Load Sizing' } },
  { id: 'n5', type: 'sld', position: { x: 440, y: 420 }, data: { label: 'Residential', icon: '💡', color: '#f97316', type: 'load', power_kw: 20, calcModule: 'energy_microgrid', calcLabel: 'Cable Sizing' } },
  { id: 'n6', type: 'sld', position: { x: 80,  y: 300 }, data: { label: 'Solar PV 100kW', icon: '☀️', color: '#f59e0b', type: 'solar', power_kw: 100, calcModule: 'energy_bess', calcLabel: 'Solar & BESS Sizing' } },
];

const STARTER_EDGES: Edge[] = [
  { id: 'e1', source: 'n1', target: 'n2', animated: true,  label: '33kV cable' },
  { id: 'e2', source: 'n2', target: 'n3', animated: false, label: '415V' },
  { id: 'e3', source: 'n3', target: 'n4', animated: false, label: '150mm² Cu' },
  { id: 'e4', source: 'n3', target: 'n5', animated: false, label: '70mm² Cu' },
  { id: 'e5', source: 'n6', target: 'n3', animated: true,  label: 'AC tie' },
];

// ── Main component ────────────────────────────────────────────────────────────

export function SLDViewer() {
  const [nodes, setNodes, onNodesChange] = useNodesState(STARTER_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(STARTER_EDGES);
  const [rfInstance, setRfInstance]       = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode]   = useState<Node | null>(null);
  const [editingLabel, setEditingLabel]   = useState('');
  const [showPanel, setShowPanel]         = useState<'props' | null>(null);
  const reactFlowWrapper                  = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, label: 'cable' }, eds)),
    [setEdges],
  );

  // Drag from palette
  const onDragStart = (e: React.DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData('application/sld-type', item.type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/sld-type');
      if (!type || !rfInstance || !reactFlowWrapper.current) return;
      const palette = PALETTE.find((p) => p.type === type);
      if (!palette) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const pos = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const newNode: Node = {
        id: `n-${Date.now()}`,
        type: 'sld',
        position: pos,
        data: {
          ...palette.defaultData,
          icon:       palette.icon,
          color:      palette.color,
          type:       palette.type,
          calcModule: palette.calcModule,
          calcLabel:  palette.calcLabel,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [rfInstance, setNodes],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Double-click node → open calculator
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as { calcModule?: string };
    if (d.calcModule) {
      useWorkspaceStore.getState().openPanel('calculator');
      useCalculationStore.getState().setModule(d.calcModule as CalculationModule);
    }
  }, []);

  // Single click node → select for property panel
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setEditingLabel(String((node.data as { label: string }).label ?? ''));
    setShowPanel('props');
  }, []);

  const applyLabelEdit = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, label: editingLabel } }
          : n,
      ),
    );
    setShowPanel(null);
  };

  const deleteSelected = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    setShowPanel(null);
  };

  const openCalcForSelected = () => {
    if (!selectedNode) return;
    const d = selectedNode.data as { calcModule?: string };
    if (d.calcModule) {
      useWorkspaceStore.getState().openPanel('calculator');
      useCalculationStore.getState().setModule(d.calcModule as CalculationModule);
      setShowPanel(null);
    }
  };

  // Export as image
  const exportPng = () => {
    const canvas = reactFlowWrapper.current?.querySelector('canvas');
    if (canvas) {
      const a = document.createElement('a');
      a.href = (canvas as HTMLCanvasElement).toDataURL('image/png');
      a.download = 'single-line-diagram.png';
      a.click();
    }
  };

  return (
    <div className="w-full h-full bg-[#0a0f1e] flex">

      {/* ── Component Palette ── */}
      <div className="w-44 flex-shrink-0 bg-[#0f172a] border-r border-slate-700 flex flex-col">
        <div className="px-3 py-2 border-b border-slate-700">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Components</p>
          <p className="text-[9px] text-gray-600 mt-0.5">Drag onto diagram</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1 space-y-0.5">
          {PALETTE.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item)}
              className="flex items-center gap-2 px-3 py-1.5 cursor-grab hover:bg-slate-700/50 transition-colors"
              title={item.calcModule ? `Opens ${item.calcLabel}` : item.label}
            >
              <span className="text-base w-6 text-center">{item.icon}</span>
              <div>
                <p className="text-[11px] text-gray-300 leading-tight">{item.label}</p>
                {item.calcModule && (
                  <p className="text-[9px] text-infra-highlight/60 leading-tight">↕ calc</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="px-3 py-2 border-t border-slate-700 text-[9px] text-gray-600 space-y-0.5">
          <p>🖱 Click node → properties</p>
          <p>↔ Drag handle → connect</p>
          <p>2×click → open calculator</p>
        </div>
      </div>

      {/* ── ReactFlow Canvas ── */}
      <div className="flex-1 relative" ref={reactFlowWrapper} onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeClick={onNodeClick}
          nodeTypes={NODE_TYPES}
          fitView
          deleteKeyCode="Delete"
        >
          <Background color="#1e293b" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) => String((n.data as { color: string }).color ?? '#64748b')}
            className="!bg-slate-900 !border-slate-700"
          />

          {/* Toolbar */}
          <Panel position="top-right">
            <div className="flex gap-1 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-1.5">
              <button
                type="button"
                onClick={exportPng}
                title="Export as PNG"
                className="px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-gray-300 rounded"
              >
                📷 Export
              </button>
            </div>
          </Panel>
        </ReactFlow>

        {/* ── Properties panel ── */}
        {showPanel === 'props' && selectedNode && (
          <div className="absolute top-3 left-3 w-56 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800/80">
              <span className="text-xs font-bold text-white">
                {String((selectedNode.data as { icon: string }).icon)} Properties
              </span>
              <button type="button" onClick={() => setShowPanel(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Label</label>
                <input
                  type="text"
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyLabelEdit()}
                  className="w-full bg-slate-800 text-white text-xs px-2 py-1.5 rounded border border-slate-600 outline-none focus:border-infra-highlight"
                />
              </div>
              <button
                type="button"
                onClick={applyLabelEdit}
                className="w-full py-1.5 text-xs bg-infra-highlight/80 hover:bg-infra-highlight text-white rounded transition-colors"
              >
                Apply
              </button>
              {(selectedNode.data as { calcModule?: string }).calcModule && (
                <button
                  type="button"
                  onClick={openCalcForSelected}
                  className="w-full py-1.5 text-xs bg-blue-700/50 hover:bg-blue-700 text-blue-200 rounded transition-colors"
                >
                  Open {(selectedNode.data as { calcLabel?: string }).calcLabel ?? 'Calculator'} →
                </button>
              )}
              <button
                type="button"
                onClick={deleteSelected}
                className="w-full py-1.5 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-300 rounded transition-colors"
              >
                Delete component
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
