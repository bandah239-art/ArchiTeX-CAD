import { useCalculationStore } from '../../../store/calculationStore';
import { MeshViewer } from '../../FEA/MeshViewer';

interface FEACalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

export function FEACalculator({ inputs, onInputChange }: FEACalculatorProps) {
  const currentResults = useCalculationStore((s) => s.currentResults);
  const isCalculating = useCalculationStore((s) => s.isCalculating);
  const runCalculation = useCalculationStore((s) => s.runCalculation);

  // Generate local preview if no calculation run yet or if input changed
  const h = Number(inputs.height ?? 4.0);
  const s = Number(inputs.span ?? 6.0);
  
  const nodes = currentResults?.nodes || [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 0, y: h },
    { id: 3, x: s, y: h },
    { id: 4, x: s, y: 0 },
  ];

  const elements = currentResults?.elements || [
    { id: 1, node_i: 1, node_j: 2 },
    { id: 2, node_i: 2, node_j: 3 },
    { id: 3, node_i: 3, node_j: 4 },
  ];

  const displacements = currentResults?.displacements;
  const dispScale = Number(inputs.scale ?? 20.0);

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Finite Element Analysis (FEA)</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">2D Portal Frame</span>
      </div>

      <p className="text-xs text-gray-300">
        Performs 2D frame direct stiffness solver. View undeformed frame (gray) and load-deflected shape (green).
      </p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field
          label="Span (m)"
          value={inputs.span ?? 6.0}
          onChange={(v) => onInputChange('span', v)}
        />
        <Field
          label="Height (m)"
          value={inputs.height ?? 4.0}
          onChange={(v) => onInputChange('height', v)}
        />
        <Field
          label="Lateral Load (N) [at Node 2]"
          value={inputs.lateral_load ?? 20000.0}
          onChange={(v) => onInputChange('lateral_load', v)}
        />
        <Field
          label="Vertical Load (N) [at Node 3]"
          value={inputs.vertical_load ?? -50000.0}
          onChange={(v) => onInputChange('vertical_load', v)}
        />
        <SelectField
          label="Support Conditions"
          value={(inputs.support_type as string) ?? 'fixed'}
          options={[
            { value: 'fixed', label: 'Fixed Base' },
            { value: 'pinned', label: 'Pinned Base' },
          ]}
          onChange={(v) => onInputChange('support_type', v)}
        />
        <Field
          label="Elastic Modulus E (Pa)"
          value={inputs.E ?? 2.0e11}
          onChange={(v) => onInputChange('E', v)}
        />
        <Field
          label="Cross Section Area A (m²)"
          value={inputs.A ?? 0.01}
          onChange={(v) => onInputChange('A', v)}
        />
        <Field
          label="Moment of Inertia I (m⁴)"
          value={inputs.I ?? 1.0e-5}
          onChange={(v) => onInputChange('I', v)}
        />
        <Field
          label="Deflection Plot Scale"
          value={inputs.scale ?? 20.0}
          onChange={(v) => onInputChange('scale', v)}
        />
      </div>

      <button
        type="button"
        disabled={isCalculating}
        onClick={() => runCalculation()}
        className="w-full mt-2 py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 transition-colors disabled:opacity-50"
      >
        {isCalculating ? 'SOLVING FRAME...' : 'RUN SOLVER'}
      </button>

      <div className="mt-4">
        <MeshViewer
          nodes={nodes}
          elements={elements}
          displacements={displacements}
          scale={dispScale}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-gray-400 font-semibold">{label}</label>
      <input
        type="number"
        value={value as number}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60 transition-all text-xs"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-gray-400 font-semibold">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60 transition-all text-xs"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
