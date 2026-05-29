import { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { API_BASE } from '../../services/apiConfig';

export function ProjectWorkspace() {
  const { currentProject } = useProjectStore();
  const projectId = currentProject?.id || 'default';

  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [engineer, setEngineer] = useState('');
  const [eizNumber, setEizNumber] = useState('');
  const [client, setClient] = useState('');

  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/project/${projectId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
        if (data.project) {
          setProjectName(data.project.name || currentProject?.name || 'Default Project');
          setLocation(data.project.location || '');
          setEngineer(data.project.engineer || '');
          setEizNumber(data.project.eiz_number || '');
          setClient(data.project.client || '');
        }
      }
    } catch (err) {
      console.error('Error fetching project summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [projectId]);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        id: projectId,
        name: projectName || currentProject?.name || 'Default Project',
        location,
        engineer,
        eiz_number: eizNumber,
        client,
      };
      const res = await fetch(`${API_BASE}/project/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        fetchSummary();
        alert('Project details saved successfully!');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save project details');
    }
  };

  const handleExportEizMemo = async () => {
    if (!summary) return;
    try {
      const payload = {
        project_id: projectId,
        project_name: projectName || 'Default Project',
        project_location: location || 'Lusaka',
        engineer_name: engineer || 'EIZ Registered Engineer',
        eiz_number: eizNumber || 'EIZ-XXXX',
        client_name: client || 'GRZ',
        calc_title: `${projectName || 'Project'} Localized Design Memo`,
        calc_ref: `EIZ-${projectId.substring(0, 5).toUpperCase()}`,
        revision: '1',
        calculation_sections: summary.calculations?.map((c: any) => ({
          title: `${c.module.toUpperCase()} Design (Revision ${c.revision})`,
          formula_steps: c.outputs?.steps?.map((s: any) => [
            s.title || '',
            s.formula || '',
            s.substitution || '',
            s.result || '',
            s.reference || '',
          ]) || [],
        })) || [],
      };

      const res = await fetch(`${API_BASE}/project/export-eiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to generate EIZ Memo');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EIZ-Memo-${payload.calc_ref}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      fetchSummary();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">
          Zambian Project Workspace
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Coordinate local design standards and produce EIZ stamped engineering memos.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Project Meta Editor Form */}
        <form onSubmit={handleSaveProject} className="p-4 bg-infra-darker/50 rounded-xl border border-infra-accent/20 space-y-3">
          <h3 className="text-xs font-bold text-infra-highlight uppercase tracking-wider">Project Identity</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. 3-Bedroom House"
                className="w-full px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-xs text-white focus:outline-none focus:border-infra-highlight"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Location (City/Province)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lusaka, Central"
                className="w-full px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-xs text-white focus:outline-none focus:border-infra-highlight"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">EIZ Engineer Name</label>
              <input
                type="text"
                value={engineer}
                onChange={(e) => setEngineer(e.target.value)}
                placeholder="e.g. Chansa Mulenga"
                className="w-full px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-xs text-white focus:outline-none focus:border-infra-highlight"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">EIZ Reg Number</label>
              <input
                type="text"
                value={eizNumber}
                onChange={(e) => setEizNumber(e.target.value)}
                placeholder="e.g. EIZ-10294"
                className="w-full px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-xs text-white focus:outline-none focus:border-infra-highlight"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] text-gray-400 mb-0.5">Client Name</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. Ministry of Infrastructure Development"
                className="w-full px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-xs text-white focus:outline-none focus:border-infra-highlight"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-1.5 bg-infra-accent hover:bg-infra-accent/80 text-white text-xs font-semibold rounded transition-colors"
          >
            Save Project Details
          </button>
        </form>

        {/* Aggregated Local Costing Card */}
        {summary && (
          <div className="p-4 bg-gradient-to-br from-indigo-900/40 to-slate-900/40 rounded-xl border border-indigo-500/20 space-y-3">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Bill of Quantities (BoQ) Estimator</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-2 bg-infra-darker/60 rounded">
                <span className="block text-[10px] text-gray-400">Total Material Cost</span>
                <span className="text-sm font-bold text-white font-mono">
                  {summary.boq_totals?.cost_zmw?.toLocaleString()} ZMW
                </span>
              </div>
              <div className="p-2 bg-infra-darker/60 rounded">
                <span className="block text-[10px] text-gray-400">Est. Rebar Weight</span>
                <span className="text-sm font-bold text-white font-mono">
                  {summary.boq_totals?.rebar_tonnes?.toFixed(3)} Tonnes
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Calculations History List */}
        <div className="p-4 bg-infra-darker/50 rounded-xl border border-infra-accent/20 space-y-2">
          <h3 className="text-xs font-bold text-infra-highlight uppercase tracking-wider mb-2">Calculations History</h3>
          {loading ? (
            <p className="text-xs text-gray-400">Loading history...</p>
          ) : summary?.calculations?.length ? (
            <div className="space-y-2">
              {summary.calculations.map((calc: any, idx: number) => {
                const isPass = calc.outputs?.status === 'pass' || calc.outputs?.status === 'ok';
                return (
                  <div key={idx} className="flex justify-between items-center p-2 bg-infra-darker/80 rounded border border-infra-accent/10">
                    <div>
                      <span className="text-xs font-bold text-white uppercase">{calc.module}</span>
                      <span className="text-[10px] text-gray-500 ml-2">Rev {calc.revision}</span>
                      <span className="block text-[9px] text-gray-400">
                        {new Date(calc.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase ${
                      isPass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {isPass ? 'PASS ✓' : 'FAIL ✗'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No calculations run yet. Run calculations in the Calculator panel to save them.</p>
          )}
        </div>

        {/* Generated Documents & Memo Export */}
        <div className="p-4 bg-infra-darker/50 rounded-xl border border-infra-accent/20 space-y-3">
          <h3 className="text-xs font-bold text-infra-highlight uppercase tracking-wider">stamped local authority exports</h3>
          <p className="text-[11px] text-gray-400">
            Generate a combined BS 8110 / BS 5628 design memorandum conforming to Council submission rules, complete with EIZ registration stamp placeholders.
          </p>
          <button
            onClick={handleExportEizMemo}
            disabled={!summary?.calculations?.length}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-lg transition-colors"
          >
            GENERATE COUNCIL-READY EIZ MEMO PDF
          </button>

          {summary?.documents?.length ? (
            <div className="mt-3 space-y-1.5">
              <span className="block text-[10px] font-bold text-gray-400 uppercase">Export History</span>
              {summary.documents.map((doc: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs text-gray-300">
                  <span className="truncate max-w-[200px]" title={doc.filename}>{doc.filename}</span>
                  <span className="text-[9px] text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
