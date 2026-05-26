import { useTranslation } from 'react-i18next';
import { useCadSessionStore } from '../../store/cadSessionStore';
import { useDrawStore } from '../../store/drawStore';
import { useSketchBlockStore } from '../../store/sketchBlockStore';
import { useSketchConstraintStore } from '../../store/sketchConstraintStore';
import { runAlignFromPanel } from '../../services/cadModifyInteraction';
import type { GeometricConstraintType } from '../../store/sketchConstraintStore';

const GEOM_TYPES: GeometricConstraintType[] = [
  'horizontal',
  'vertical',
  'parallel',
  'perpendicular',
  'coincident',
  'equal',
  'fix',
];

export function CadToolsPanel() {
  const { t } = useTranslation();
  const command = useCadSessionStore((s) => s.command);
  const hint = useCadSessionStore((s) => s.hint);
  const panelOpen = useCadSessionStore((s) => s.panelOpen);
  const alignIds = useCadSessionStore((s) => s.data.alignIds);
  const setHint = useCadSessionStore((s) => s.setHint);
  const setStep = useCadSessionStore((s) => s.setStep);
  const clear = useCadSessionStore((s) => s.clear);
  const setPanelOpen = useCadSessionStore((s) => s.setPanelOpen);

  const elements = useDrawStore((s) => s.elements);
  const selectedId = useDrawStore((s) => s.selectedId);
  const modifiers = useDrawStore((s) => s.modifiers);
  const setModifiers = useDrawStore((s) => s.setModifiers);

  const blockNames = useSketchBlockStore((s) => s.definitions.map((d) => d.name));
  const activeBlock = useSketchBlockStore((s) => s.activeBlockName);
  const setActiveBlock = useSketchBlockStore((s) => s.setActiveBlock);
  const createBlock = useSketchBlockStore((s) => s.createFromElements);

  const constraints = useSketchConstraintStore((s) => s.constraints);
  const addGeom = useSketchConstraintStore((s) => s.addGeometric);
  const removeCon = useSketchConstraintStore((s) => s.remove);
  const barVisible = useSketchConstraintStore((s) => s.barVisible);

  if (!command && !panelOpen && !barVisible) return null;

  const handleCreateBlock = () => {
    const name = window.prompt('Block name', 'Block1');
    if (!name) return;
    const sel = selectedId
      ? elements.filter((e) => e.id === selectedId)
      : elements;
    if (!sel.length) {
      setHint('Select sketch elements or draw geometry first.');
      return;
    }
    const cx = sel[0].points[0]?.x ?? 0;
    const cz = sel[0].points[0]?.z ?? 0;
    const y = sel[0].points[0]?.y ?? 0;
    createBlock(name, sel, { x: cx, y, z: cz });
    setActiveBlock(name);
    setHint(`Block "${name}" created.`);
    clear();
  };

  const handleWblock = () => {
    const name = activeBlock ?? blockNames[0];
    if (!name) {
      setHint('Create a block first.');
      return;
    }
    const def = useSketchBlockStore.getState().exportWblock(name);
    if (def) {
      const blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.skblock.json`;
      a.click();
      URL.revokeObjectURL(url);
      setHint(`Exported WBLOCK ${name}.`);
    }
  };

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 max-w-lg w-full px-4 pointer-events-none">
      <div className="pointer-events-auto bg-infra-dark/95 border border-infra-accent/50 rounded-xl shadow-xl p-3 text-sm text-gray-200">
        {hint && <p className="text-infra-accent mb-2">{hint}</p>}

        {(command === 'offset' || command === 'fillet' || command === 'chamfer') && (
          <div className="flex flex-wrap gap-2 mb-2">
            {command === 'offset' && (
              <label className="flex items-center gap-1">
                {t('tools.cad.offsetDist', 'Offset')}
                <input
                  type="number"
                  step={0.1}
                  className="w-16 px-1 py-0.5 rounded bg-black/40 border border-infra-accent/40"
                  value={modifiers.offsetDistance ?? 1}
                  onChange={(e) => setModifiers({ offsetDistance: Number(e.target.value) })}
                />
              </label>
            )}
            {command === 'fillet' && (
              <label className="flex items-center gap-1">
                {t('tools.cad.filletR', 'Radius')}
                <input
                  type="number"
                  step={0.05}
                  className="w-16 px-1 py-0.5 rounded bg-black/40 border border-infra-accent/40"
                  value={modifiers.filletRadius ?? 0.5}
                  onChange={(e) => setModifiers({ filletRadius: Number(e.target.value) })}
                />
              </label>
            )}
            {command === 'chamfer' && (
              <label className="flex items-center gap-1">
                {t('tools.cad.chamferD', 'Dist')}
                <input
                  type="number"
                  step={0.05}
                  className="w-16 px-1 py-0.5 rounded bg-black/40 border border-infra-accent/40"
                  value={modifiers.chamferDistance ?? 0.3}
                  onChange={(e) => setModifiers({ chamferDistance: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
        )}

        {(command?.startsWith('block') || panelOpen) && (
          <div className="space-y-2 mb-2">
            <div className="font-medium text-white">{t('tools.cad.blocks', 'Blocks')}</div>
            <select
              className="w-full px-2 py-1 rounded bg-black/40 border border-infra-accent/40"
              value={activeBlock ?? ''}
              onChange={(e) => setActiveBlock(e.target.value || null)}
            >
              <option value="">— {t('tools.cad.pickBlock', 'select block')} —</option>
              {blockNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="cad-panel-btn" onClick={handleCreateBlock}>
                {t('tools.cad.blockCreate', 'Create')}
              </button>
              <button type="button" className="cad-panel-btn" onClick={handleWblock}>
                WBLOCK
              </button>
              <button
                type="button"
                className="cad-panel-btn"
                onClick={() => {
                  useCadSessionStore.getState().startCommand('block-insert');
                }}
              >
                {t('tools.cad.blockInsert', 'Insert')}
              </button>
            </div>
            <p className="text-xs text-gray-400">{t('tools.cad.xrefHint', 'XREF: import via IFC or JSON block file.')}</p>
          </div>
        )}

        {(command === 'align' || (alignIds && alignIds.length >= 2)) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {(['left', 'center', 'right', 'bottom', 'middle', 'top'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="cad-panel-btn"
                onClick={() => runAlignFromPanel(m, null)}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {(command?.startsWith('param') || barVisible) && (
          <div className="space-y-2 mb-2">
            <div className="font-medium text-white">{t('tools.cad.constraints', 'Constraints')}</div>
            <div className="flex flex-wrap gap-1">
              {GEOM_TYPES.map((gt) => (
                <button
                  key={gt}
                  type="button"
                  className="cad-panel-btn text-xs"
                  onClick={() => {
                    setStep(0, { constraintType: gt, alignIds: [] });
                    useCadSessionStore.getState().startCommand('param-geom');
                    useCadSessionStore.getState().setHint(`Pick entities for ${gt}.`);
                  }}
                >
                  {gt}
                </button>
              ))}
              <button
                type="button"
                className="cad-panel-btn text-xs"
                onClick={() => {
                  useCadSessionStore.getState().startCommand('param-dim');
                }}
              >
                dim
              </button>
            </div>
            {constraints.length > 0 && (
              <ul className="text-xs max-h-24 overflow-auto">
                {constraints.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span>
                      {c.type} ({c.elementIds.join(', ')})
                    </span>
                    <button type="button" className="text-red-400" onClick={() => removeCon(c.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedId && (
              <button
                type="button"
                className="cad-panel-btn"
                onClick={() => {
                  const type = useCadSessionStore.getState().data.constraintType as GeometricConstraintType;
                  if (type) addGeom(type, [selectedId]);
                }}
              >
                {t('tools.cad.constrainSel', 'Constrain selection')}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className="text-xs text-gray-400 hover:text-white mt-1"
          onClick={() => {
            clear();
            setPanelOpen(false);
            useSketchConstraintStore.getState().setBarVisible(false);
          }}
        >
          {t('common.cancel', 'Cancel')}
        </button>
      </div>
      <style>{`
        .cad-panel-btn {
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(0, 180, 216, 0.15);
          border: 1px solid rgba(0, 180, 216, 0.4);
          color: #e0f7fa;
        }
        .cad-panel-btn:hover { background: rgba(0, 180, 216, 0.3); }
      `}</style>
    </div>
  );
}
