import { useState, useEffect } from 'react';

const CLS =
  'w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60';

function toStr(v: unknown): string {
  if (v == null || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? '' : String(n);
}

/**
 * Inner numeric input that keeps local display state so the user can type
 * freely (clear, type decimals, negatives) without React resetting the field.
 */
export function NumericInput({
  value,
  onChange,
  step,
  className,
}: {
  value: unknown;
  onChange: (v: number) => void;
  step?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => toStr(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDisplay(toStr(value));
  }, [value, focused]);

  return (
    <input
      type="number"
      step={step ?? 'any'}
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        setFocused(false);
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) {
          onChange(n);
        } else {
          const fallback = Number(value) || 0;
          setDisplay(String(fallback));
          onChange(fallback);
        }
      }}
      onChange={(e) => {
        setDisplay(e.target.value);
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) onChange(n);
      }}
      className={className ?? CLS}
    />
  );
}

export function NumField({
  label,
  value,
  onChange,
  warnLow,
  warnHigh,
  warnMsg,
}: {
  label: string;
  value: unknown;
  onChange: (v: number) => void;
  warnLow?: number;
  warnHigh?: number;
  warnMsg?: string;
}) {
  const n = Number(value);
  const outOfRange =
    (!isNaN(n) && warnLow !== undefined && n < warnLow) ||
    (!isNaN(n) && warnHigh !== undefined && n > warnHigh);
  const hint =
    outOfRange
      ? warnMsg ?? `Typical range: ${warnLow ?? ''}–${warnHigh ?? ''}`
      : undefined;

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <NumericInput
        value={value}
        onChange={onChange}
        className={`w-full px-2 py-1.5 text-sm bg-infra-darker border rounded text-white focus:outline-none transition-colors ${
          outOfRange
            ? 'border-amber-500/70 focus:border-amber-400'
            : 'border-infra-accent/40 focus:border-infra-highlight/60'
        }`}
      />
      {hint && (
        <p className="text-[10px] text-amber-400 mt-0.5">⚠ {hint}</p>
      )}
    </div>
  );
}

export function SelectField({
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
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={CLS}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormField({
  label,
  type = 'text',
  value,
  onChange,
  step,
}: {
  label: string;
  type?: 'text' | 'number';
  value: number | string;
  onChange: (val: number | string) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {type === 'number' ? (
        <NumericInput value={value} onChange={(n) => onChange(n)} step={step} />
      ) : (
        <input
          type="text"
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          className={CLS}
        />
      )}
    </div>
  );
}
