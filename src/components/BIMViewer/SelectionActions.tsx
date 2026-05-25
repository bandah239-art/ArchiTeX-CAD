import { useViewerStore } from '../../store/viewerStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useBoQStore } from '../../store/boqStore';
import { useCalculationStore } from '../../store/calculationStore';
import { usePlatformToolsStore } from '../../store/platformToolsStore';
import { toBimPayload } from '../../services/ifcBoqService';
import { calcModuleForIfcType } from '../../services/selectionBridge';
import type { IFCElement } from '../../types/ifc';

interface SelectionActionsProps {
  element: IFCElement | null;
}

export function SelectionActions({ element }: SelectionActionsProps) {
  const { resolvedBoxSelection, viewerControls } = useViewerStore();
  const openPanel = useWorkspaceStore((s) => s.openPanel);
  const importFromBim = useBoQStore((s) => s.importFromBim);
  const isImportingBim = useBoQStore((s) => s.isImportingBim);
  const prefillFromElement = useCalculationStore((s) => s.prefillFromElement);
  const runPlatformAction = usePlatformToolsStore((s) => s.runPlatformAction);
  const isRunning = usePlatformToolsStore((s) => s.isRunning);

  const targets =
    resolvedBoxSelection.length > 0
      ? resolvedBoxSelection
      : element
        ? [element]
        : [];

  if (!targets.length) return null;

  const primary = element ?? targets[0];
  const calcModule = primary ? calcModuleForIfcType(primary.type) : null;
  const multi = targets.length > 1;

  return (
    <section className="mb-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400 mb-2">
        {multi ? `Selection (${targets.length})` : 'Actions'}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        <ActionBtn
          label={multi ? `BoQ (${targets.length})` : 'Send to BoQ'}
          disabled={isImportingBim || !targets.length}
          onClick={() => {
            const payload = toBimPayload(targets);
            if (!payload.length) return;
            openPanel('boq');
            void importFromBim(payload);
          }}
        />
        {calcModule && primary && (
          <ActionBtn
            label={`${calcModule} calc`}
            onClick={() => {
              prefillFromElement(primary);
              openPanel('calculator');
            }}
          />
        )}
        <ActionBtn
          label="Isolate"
          onClick={() => {
            const ids = targets.map((t) => (t.id.startsWith('ifc-') ? t.id : `ifc-${t.id}`));
            viewerControls?.isolateEntities(ids);
          }}
        />
        <ActionBtn
          label="Clash"
          disabled={isRunning || targets.length < 2}
          title={targets.length < 2 ? 'Pick one element, then box-select another' : undefined}
          onClick={() => void runPlatformAction('bim.clash')}
        />
        <ActionBtn
          label="Geo site"
          onClick={() => openPanel('geo')}
        />
      </div>
      {multi && (
        <p className="text-[10px] text-gray-500 mt-2">
          Clash uses primary pick + box selection. Click list items to set primary.
        </p>
      )}
    </section>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded bg-infra-accent/40 hover:bg-emerald-700/50 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  );
}
