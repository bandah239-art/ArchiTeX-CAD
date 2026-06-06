import { useState } from 'react';
import type { CalculationResult } from '../../types/calculations';
import { exportToPDF, exportToExcel } from '../../services/exportService';
import { useEngineerReviewStore } from '../../store/engineerReviewStore';

interface ReportExporterProps {
  result: CalculationResult;
}

export function ReportExporter({ result }: ReportExporterProps) {
  const [showModal, setShowModal] = useState(false);
  const { engineerName, registrationNumber } = useEngineerReviewStore();
  const [formData, setFormData] = useState({
    engineerName: engineerName || '',
    eizNumber: registrationNumber || '',
    projectRef: '',
    designBrief: ''
  });

  // Hard gate: block export when any step has failed or there are errors
  const hasFail = result.status === 'fail' || (result.errors && result.errors.length > 0);
  const hasUnreviewedFail = result.steps?.some(
    (s) => s.status === 'fail' && (!s.review_status || s.review_status === 'pending')
  );
  const exportBlocked = hasFail || hasUnreviewedFail;
  const isDraftExport = exportBlocked || (result.steps?.some((s) => !s.review_status || s.review_status === 'pending') ?? false);

  const blockReason = result.status === 'fail'
    ? 'Calculation has FAIL status — resolve all errors before exporting.'
    : hasUnreviewedFail
      ? 'One or more FAIL steps have not been reviewed. Accept or override before exporting.'
      : '';

  const handleExportPdf = () => {
    setShowModal(true);
  };

  const submitPdfExport = async () => {
    setShowModal(false);
    await exportToPDF(result, {
      project_ref: formData.projectRef,
      design_brief: formData.designBrief,
      engineer_name: formData.engineerName,
      eiz_number: formData.eizNumber,
    });
  };

  return (
    <>
      {exportBlocked && (
        <div className="mt-3 p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300 flex items-start gap-1.5">
          <span className="font-bold shrink-0">⛔</span>
          <span>{blockReason}</span>
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleExportPdf}
          disabled={exportBlocked}
          title={exportBlocked ? blockReason : 'Export calculation report as PDF'}
          className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Export PDF
        </button>
        <button
          onClick={() => exportToExcel(result)}
          disabled={exportBlocked}
          title={exportBlocked ? blockReason : 'Export to Excel'}
          className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Export Excel
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-infra-surface p-6 rounded shadow-lg w-full max-w-md border border-infra-accent/20">
            <h2 className="text-lg font-bold mb-4 text-infra-text">Project Details</h2>
            {isDraftExport && !exportBlocked && (
              <p className="text-xs text-amber-400 mb-3">
                Report will include DRAFT ONLY watermark until all steps are reviewed and accepted.
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1">Engineer Name</label>
                <input 
                  type="text" 
                  value={formData.engineerName} 
                  onChange={e => setFormData({ ...formData, engineerName: e.target.value })}
                  className="w-full bg-infra-bg border border-infra-accent/30 rounded p-2 text-sm text-infra-text"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">EIZ Registration No.</label>
                <input 
                  type="text" 
                  value={formData.eizNumber} 
                  onChange={e => setFormData({ ...formData, eizNumber: e.target.value })}
                  className="w-full bg-infra-bg border border-infra-accent/30 rounded p-2 text-sm text-infra-text"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Project Reference</label>
                <input 
                  type="text" 
                  value={formData.projectRef} 
                  onChange={e => setFormData({ ...formData, projectRef: e.target.value })}
                  className="w-full bg-infra-bg border border-infra-accent/30 rounded p-2 text-sm text-infra-text"
                  placeholder="e.g. PRJ-2026-001"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Design Brief Summary</label>
                <textarea 
                  value={formData.designBrief} 
                  onChange={e => setFormData({ ...formData, designBrief: e.target.value })}
                  className="w-full bg-infra-bg border border-infra-accent/30 rounded p-2 text-sm text-infra-text min-h-[80px]"
                  placeholder="Brief description of the structure and assumptions..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs border border-gray-600 hover:bg-gray-800 rounded transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={submitPdfExport}
                className="px-4 py-2 text-xs bg-infra-accent text-white hover:bg-infra-accent/80 rounded transition-colors font-bold"
              >
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
