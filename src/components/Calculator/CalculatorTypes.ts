export interface CalculatorFormProps {
  onInputChange: (key: string, value: unknown) => void;
  inputs: Record<string, unknown>;
}

export const CONCRETE_GRADES = [25, 30, 35, 40];
export const STEEL_GRADES = [250, 460, 500];
export const SLAB_STEEL_GRADES = [460, 500];
export const EXPOSURE_CLASSES = ['XC1', 'XC2', 'XC3', 'XC4'];
export const DESIGN_CODES = ['Eurocode2', 'ACI318'];
export const SUPPORT_CONDITIONS = [
  { value: 'simply_supported', label: 'Simply Supported' },
  { value: 'continuous_end', label: 'Continuous (End Span)' },
  { value: 'continuous_internal', label: 'Continuous (Internal)' },
  { value: 'cantilever', label: 'Cantilever' },
];
export const SLAB_SUPPORT_CONDITIONS = [
  { value: 'simply_supported', label: 'Simply Supported' },
  { value: 'continuous', label: 'Continuous' },
];
export const LE_FACTORS = [
  { value: '0.5', label: '0.5 — Pinned-Fixed' },
  { value: '0.7', label: '0.7 — Fixed-Pinned' },
  { value: '0.85', label: '0.85 — Braced (typical)' },
  { value: '1.0', label: '1.0 — Pinned-Pinned' },
  { value: '2.0', label: '2.0 — Cantilever' },
];
