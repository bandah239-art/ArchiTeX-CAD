type InputGroupBase = {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
};

type NumberInputGroup = InputGroupBase & {
  type: 'number';
  unit?: string;
  options?: never;
};

type SelectInputGroup = InputGroupBase & {
  type: 'select';
  options: { label: string; value: string }[];
  unit?: never;
};

export type InputGroupProps = NumberInputGroup | SelectInputGroup;

export function InputGroup(props: InputGroupProps) {
  const { label, value, onChange } = props;

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {props.type === 'select' ? (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
        >
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value as number}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="flex-1 min-w-0 px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
          />
          {props.unit ? <span className="text-xs text-gray-500 shrink-0">{props.unit}</span> : null}
        </div>
      )}
    </div>
  );
}
