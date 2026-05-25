interface DepthRow {
  depth_m?: number;
  pressure_kpa?: number;
  status?: string;
}

export function DepthTable({ rows, title = 'Pressure vs depth' }: { rows: DepthRow[]; title?: string }) {
  if (!rows?.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-infra-accent/30 overflow-hidden">
      <div className="px-3 py-2 bg-gray-900/80 text-xs font-semibold text-gray-400 uppercase">{title}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-900/50 text-gray-500">
            <th className="text-left px-3 py-1.5 font-medium">Depth (m)</th>
            <th className="text-left px-3 py-1.5 font-medium">Pressure (kPa)</th>
            <th className="text-left px-3 py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-800/80">
              <td className="px-3 py-1.5 text-gray-300">{row.depth_m ?? '—'}</td>
              <td className="px-3 py-1.5 text-gray-200">{row.pressure_kpa ?? '—'}</td>
              <td
                className={`px-3 py-1.5 ${
                  row.status?.includes('✗') || row.status?.toUpperCase() === 'FAIL'
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}
              >
                {row.status ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function extractDepthTable(summary: Record<string, unknown>): DepthRow[] | null {
  const raw = summary.depth_table;
  if (!Array.isArray(raw)) return null;
  return raw as DepthRow[];
}
