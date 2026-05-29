import { useState } from 'react';
import { API_BASE } from '../../../services/apiConfig';

interface CalcSection { title: string; content: string; }

const TODAY = new Date().toISOString().slice(0, 10);

export function EIZMemoCalculator() {
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('Lusaka');
  const [engineerName, setEngineerName] = useState('');
  const [eizNumber, setEizNumber] = useState('EIZ-');
  const [clientName, setClientName] = useState('');
  const [localAuthority, setLocalAuthority] = useState('Lusaka City Council');
  const [calcRef, setCalcRef] = useState('INFRA-01');
  const [revision, setRevision] = useState('A');
  const [date, setDate] = useState(TODAY);
  const [sections, setSections] = useState<CalcSection[]>([
    { title: 'Design Basis', content: 'Design code: BS 8110:1997. Loads per BS 6399.' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addSection() {
    setSections([...sections, { title: '', content: '' }]);
  }

  function removeSection(i: number) {
    setSections(sections.filter((_, idx) => idx !== i));
  }

  function updateSection(i: number, field: keyof CalcSection, val: string) {
    setSections(sections.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  async function downloadMemo() {
    if (!projectName.trim()) { setError('Project name is required.'); return; }
    if (!engineerName.trim()) { setError('Engineer name is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/project/export-eiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName,
          project_location: location,
          engineer_name: engineerName,
          eiz_number: eizNumber,
          client_name: clientName,
          local_authority: localAuthority,
          calc_ref: calcRef,
          revision,
          date,
          calc_title: `${projectName} — Structural Calculation Memo`,
          calculation_sections: sections,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EIZ-Memo-${calcRef}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const INPUT_CLS = 'w-full px-2 py-1.5 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60';

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">EIZ Calculation Memo</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">PDF Export</span>
      </div>

      {/* Project metadata */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20 space-y-2">
        <h4 className="text-xs font-bold text-white">Project Details</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Project Name *</label>
            <input className={INPUT_CLS} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Lusaka Clinic — Block A" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <input className={INPUT_CLS} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Client</label>
            <input className={INPUT_CLS} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Ministry of Health" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Local Authority</label>
            <input className={INPUT_CLS} value={localAuthority} onChange={(e) => setLocalAuthority(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Engineer */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20 space-y-2">
        <h4 className="text-xs font-bold text-white">Engineer Details</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Engineer Name *</label>
            <input className={INPUT_CLS} value={engineerName} onChange={(e) => setEngineerName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">EIZ Number</label>
            <input className={INPUT_CLS} value={eizNumber} onChange={(e) => setEizNumber(e.target.value)} placeholder="EIZ-XXXX" />
          </div>
        </div>
      </div>

      {/* Document reference */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20 space-y-2">
        <h4 className="text-xs font-bold text-white">Document Reference</h4>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Calc Reference</label>
            <input className={INPUT_CLS} value={calcRef} onChange={(e) => setCalcRef(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Revision</label>
            <input className={INPUT_CLS} value={revision} onChange={(e) => setRevision(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date</label>
            <input type="date" className={INPUT_CLS} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Calculation sections */}
      <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-bold text-white">Calculation Sections</h4>
          <button type="button" onClick={addSection} className="text-xs px-2 py-0.5 border border-infra-highlight/50 rounded text-infra-highlight hover:bg-infra-highlight/10">+ Add Section</button>
        </div>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {sections.map((s, i) => (
            <div key={i} className="p-2 border border-infra-accent/20 rounded space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Section {i + 1}</span>
                <button type="button" onClick={() => removeSection(i)} className="text-xs text-red-400 hover:text-red-300">✕</button>
              </div>
              <input
                className={INPUT_CLS}
                value={s.title}
                onChange={(e) => updateSection(i, 'title', e.target.value)}
                placeholder="Section title"
              />
              <textarea
                className={`${INPUT_CLS} h-20 resize-none`}
                value={s.content}
                onChange={(e) => updateSection(i, 'content', e.target.value)}
                placeholder="Calculation narrative, results, references..."
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={downloadMemo}
        disabled={loading}
        className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? 'GENERATING PDF...' : '⬇ DOWNLOAD EIZ MEMO PDF'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      <p className="text-[10px] text-gray-600 italic">
        Generates a stamped calculation memo in EIZ/Zambia council format. Fill all sections before downloading.
      </p>
    </div>
  );
}
