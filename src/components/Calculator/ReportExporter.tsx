import type { CalculationResult } from '../../types/calculations';
import { exportToPDF, exportToExcel } from '../../services/exportService';

interface ReportExporterProps {
  result: CalculationResult;
}

export function ReportExporter({ result }: ReportExporterProps) {
  return (
    <div className="flex gap-2 mt-4">
      <button
        onClick={() => exportToPDF(result)}
        className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded transition-colors"
      >
        Export PDF
      </button>
      <button
        onClick={() => exportToExcel(result)}
        className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded transition-colors"
      >
        Export Excel
      </button>
    </div>
  );
}
