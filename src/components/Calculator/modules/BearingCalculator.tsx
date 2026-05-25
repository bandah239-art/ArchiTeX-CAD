import { type CalculatorFormProps } from '../../../types/calculations';
import { NumField, SelectField } from '../FormElements';

const BEARING_TYPES = [
  { value: 'elastomeric', label: 'Elastomeric Bearing' },
  { value: 'pad', label: 'Concrete/Masonry Pad Bearing' },
];

const MATERIALS = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'steel', label: 'Steel' },
];

export function BearingCalculator({ inputs, onInputChange }: CalculatorFormProps) {
  const bearingType = inputs.bearing_type ?? 'elastomeric';

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-200 border-b border-gray-700 pb-2">
        Bearing Parameters
      </h3>
      
      <SelectField
        label="Bearing Type"
        value={bearingType as string}
        options={BEARING_TYPES}
        onChange={(v) => onInputChange('bearing_type', v)}
      />
      
      <NumField
        label="Vertical Load (kN)"
        value={inputs.vertical_load ?? 800}
        onChange={(v) => onInputChange('vertical_load', v)}
      />
      <NumField
        label="Horizontal Load (kN)"
        value={inputs.horizontal_load ?? 40}
        onChange={(v) => onInputChange('horizontal_load', v)}
      />
      <NumField
        label="Span (m)"
        value={inputs.span ?? 15}
        onChange={(v) => onInputChange('span', v)}
      />
      <NumField
        label="Rotation (rad)"
        value={inputs.rotation ?? 0.01}
        onChange={(v) => onInputChange('rotation', v)}
      />

      {bearingType === 'elastomeric' && (
        <>
          <h4 className="text-xs font-semibold text-infra-highlight mt-4 mb-2">Elastomeric Properties</h4>
          <NumField
            label="Allowable Stress (MPa)"
            value={inputs.sigma_allow ?? 10.0}
            onChange={(v) => onInputChange('sigma_allow', v)}
          />
          <NumField
            label="Horizontal Movement (mm)"
            value={inputs.horizontal_movement_mm ?? 40.0}
            onChange={(v) => onInputChange('horizontal_movement_mm', v)}
          />
          <NumField
            label="Layer Thickness (mm)"
            value={inputs.layer_thickness_mm ?? 10.0}
            onChange={(v) => onInputChange('layer_thickness_mm', v)}
          />
        </>
      )}

      {bearingType === 'pad' && (
        <>
          <h4 className="text-xs font-semibold text-infra-highlight mt-4 mb-2">Pad Properties</h4>
          <SelectField
            label="Support Material"
            value={(inputs.material as string) ?? 'concrete'}
            options={MATERIALS}
            onChange={(v) => onInputChange('material', v)}
          />
          {inputs.material === 'concrete' && (
            <NumField
              label="Concrete fck (MPa)"
              value={inputs.fck ?? 30}
              onChange={(v) => onInputChange('fck', v)}
            />
          )}
          <NumField
            label="Bearing Width (mm)"
            value={inputs.bearing_width ?? 300}
            onChange={(v) => onInputChange('bearing_width', v)}
          />
          <NumField
            label="Column Width (mm)"
            value={inputs.column_width ?? 200}
            onChange={(v) => onInputChange('column_width', v)}
          />
          <NumField
            label="Pad Thickness (mm)"
            value={inputs.pad_thickness ?? 20}
            onChange={(v) => onInputChange('pad_thickness', v)}
          />
        </>
      )}
    </div>
  );
}
