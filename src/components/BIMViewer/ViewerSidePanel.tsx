import { useState } from 'react';
import { ElementInspector } from './ElementInspector';
import { AssetsPanel } from './AssetsPanel';
import { QuantitiesPanel } from './QuantitiesPanel';
import { GeometryKernelPanel } from './GeometryKernelPanel';
import type { IFCElement } from '../../types/ifc';

type Tab = 'inspector' | 'assets' | 'quantities' | 'geometry';

interface ViewerSidePanelProps {
  element: IFCElement | null;
}

export function ViewerSidePanel({ element }: ViewerSidePanelProps) {
  const [tab, setTab] = useState<Tab>('assets');

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-infra-accent/30">
        {(
          [
            ['assets', 'Assets'],
            ['inspector', 'Inspector'],
            ['quantities', 'Takeoff'],
            ['geometry', 'Kernel'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              tab === id
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-900/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'inspector' && <ElementInspector element={element} />}
        {tab === 'assets' && <AssetsPanel />}
        {tab === 'quantities' && <QuantitiesPanel />}
        {tab === 'geometry' && <GeometryKernelPanel />}
      </div>
    </div>
  );
}
