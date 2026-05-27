import { useState, useEffect } from 'react';
import { API_BASE } from '../../../services/apiConfig';
import { PressureContour } from '../../Wind/PressureContour';

const SHAPE_LABELS: Record<string, string> = {
  rectangular: 'Rectangular (20×30m)',
  square: 'Square (20×20m)',
  wide: 'Wide/Flat (40×15m)',
  elliptical: 'Elliptical',
  L_shape: 'L-Shape',
  octagonal: 'Octagonal',
};

interface ShapeData {
  x: number[];
  y: number[];
}

export function WindCFDCalculator({ inputs, onInputChange }: { inputs: Record<string, unknown>; onInputChange: (k: string, v: unknown) => void }) {
  const [shapes, setShapes] = useState<Record<string, ShapeData>>({});
  const [loadingShapes, setLoadingShapes] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/wind/building-shapes`)
      .then((r) => r.json())
      .then((d) => { setShapes(d); setLoadingShapes(false); })
      .catch(() => setLoadingShapes(false));
  }, []);

  const selectedShape = String(inputs.shape ?? 'rectangular');
  const windSpeed = Number(inputs.wind_speed ?? 10);
  const windAngle = Number(inputs.wind_angle ?? 0);

  const shapeData = shapes[selectedShape] ?? { x: [], y: [] };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Building Cross-Section</label>
        {loadingShapes ? (
          <div className="text-xs text-gray-500">Loading shapes…</div>
        ) : (
          <select
            value={selectedShape}
            onChange={(e) => onInputChange('shape', e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none"
          >
            {Object.keys(shapes).map((k) => (
              <option key={k} value={k}>{SHAPE_LABELS[k] ?? k}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Wind Speed (m/s)</label>
          <input
            type="number" min={1} max={80} step={1}
            value={windSpeed}
            onChange={(e) => onInputChange('wind_speed', parseFloat(e.target.value) || 10)}
            className="w-full px-2 py-1 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Wind Direction (°)</label>
          <input
            type="number" min={0} max={360} step={5}
            value={windAngle}
            onChange={(e) => onInputChange('wind_angle', parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none"
          />
        </div>
      </div>

      <p className="text-[10px] text-gray-500">
        2D potential-flow panel method (Hess-Smith). Computes Cp distribution, velocity field, and net drag/lift coefficients.
        Color scale: blue = suction (Cp&lt;0), red = stagnation (Cp→1).
      </p>

      {shapeData.x.length > 0 && (
        <PressureContour
          polygon_x={shapeData.x}
          polygon_y={shapeData.y}
          wind_speed_ms={windSpeed}
          wind_angle_deg={windAngle}
        />
      )}
    </div>
  );
}
