import { useEffect, useState } from 'react';
import { emergingAPI } from '../../services/emergingAPI';

const inputCls = 'px-2 py-1.5 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white w-full';
const labelCls = 'block text-gray-400 mb-0.5';
const btnCls = 'w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider disabled:opacity-50';
const sectionCls = 'bg-infra-darker/60 rounded border border-infra-accent/20 overflow-hidden';
const summaryBaseCls = 'flex items-center justify-between px-3 py-2 cursor-pointer select-none text-gray-300 font-semibold text-xs uppercase tracking-wide hover:text-white';
const resultsCls = 'p-2 bg-black/30 rounded text-[10px] text-gray-300 overflow-x-auto whitespace-pre-wrap break-words';

function SectionHeader({ label, open }: { label: string; open: boolean }) {
  return (
    <div className={summaryBaseCls}>
      <span>{label}</span>
      <span className="text-infra-accent/60">{open ? '▲' : '▼'}</span>
    </div>
  );
}

function Toggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={sectionCls}>
      <button type="button" className="w-full text-left" onClick={() => setOpen(o => !o)}>
        <SectionHeader label={label} open={open} />
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={`${labelCls} text-xs`}>{label}</label>
      {children}
    </div>
  );
}

function ResultBox({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return <pre className={resultsCls}>{JSON.stringify(data, null, 2)}</pre>;
}

interface Capability {
  feature: string;
  enabled: boolean;
  engine: string;
  requires?: { pip?: string[]; system?: string[]; env?: string[]; notes?: string };
}

const CAP_LABELS: Record<string, string> = {
  cv_safety: 'CV Safety',
  thermal: 'Thermal',
  satellite: 'Satellite AI',
  drone: 'Drone',
};

function CapabilitiesBanner() {
  const [caps, setCaps] = useState<Record<string, Capability> | null>(null);

  useEffect(() => {
    emergingAPI.capabilities().then((r) => setCaps(r.capabilities)).catch(() => null);
  }, []);

  if (!caps) return null;

  return (
    <div className={sectionCls}>
      <p className={`${summaryBaseCls} cursor-default`}>Engine Status</p>
      <div className="px-3 pb-3 pt-1 space-y-1.5">
        {Object.values(caps).map((c) => {
          const reqs = [
            ...(c.requires?.pip ?? []).map((p) => `pip: ${p}`),
            ...(c.requires?.system ?? []),
            ...(c.requires?.env ?? []).map((e) => `env: ${e}`),
          ];
          return (
            <div key={c.feature} className="flex items-start justify-between gap-2 text-[10px]">
              <span className="text-gray-300">{CAP_LABELS[c.feature] ?? c.feature}</span>
              <div className="text-right">
                <span className={c.enabled ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {c.enabled ? '● LIVE' : '○ PREVIEW'}
                </span>
                {!c.enabled && reqs.length > 0 && (
                  <div className="text-gray-500 mt-0.5">needs {reqs.join(', ')}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-red-400 text-[10px] mt-1">{msg}</p>;
}

function ThermalSection() {
  const [floor_area_m2, setFloorArea] = useState('150');
  const [u_wall, setUWall] = useState('0.35');
  const [u_roof, setURoof] = useState('0.25');
  const [u_floor, setUFloor] = useState('0.45');
  const [glazing_ratio, setGlazing] = useState('0.3');
  const [location, setLocation] = useState('Lusaka');
  const [occupancy, setOccupancy] = useState('residential');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await emergingAPI.thermal({ floor_area_m2: +floor_area_m2, u_wall: +u_wall, u_roof: +u_roof, u_floor: +u_floor, glazing_ratio: +glazing_ratio, location, occupancy });
      setResult(r);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const keys = ['annual_heating_kwh', 'annual_cooling_kwh', 'peak_load_kw', 'energy_label', 'eui_kwh_m2'];
  const display = result ? Object.fromEntries(keys.filter(k => k in result).map(k => [k, result[k]])) : null;

  return (
    <Toggle label="Thermal Building Simulation">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Floor area (m²)"><input type="number" value={floor_area_m2} onChange={e => setFloorArea(e.target.value)} className={inputCls} /></Field>
        <Field label="Wall U-value (W/m²K)"><input type="number" step="0.01" value={u_wall} onChange={e => setUWall(e.target.value)} className={inputCls} /></Field>
        <Field label="Roof U-value"><input type="number" step="0.01" value={u_roof} onChange={e => setURoof(e.target.value)} className={inputCls} /></Field>
        <Field label="Floor U-value"><input type="number" step="0.01" value={u_floor} onChange={e => setUFloor(e.target.value)} className={inputCls} /></Field>
        <Field label="Glazing ratio"><input type="number" step="0.01" value={glazing_ratio} onChange={e => setGlazing(e.target.value)} className={inputCls} /></Field>
        <Field label="Location"><input type="text" value={location} onChange={e => setLocation(e.target.value)} className={inputCls} /></Field>
        <Field label="Occupancy">
          <select value={occupancy} onChange={e => setOccupancy(e.target.value)} className={inputCls}>
            <option value="residential">Residential</option>
            <option value="office">Office</option>
            <option value="school">School</option>
          </select>
        </Field>
      </div>
      <button type="button" onClick={run} disabled={loading} className={btnCls}>{loading ? 'Simulating…' : 'Run Thermal Simulation'}</button>
      <ErrorMsg msg={err} />
      {display && (
        <div className="grid grid-cols-2 gap-1 mt-1">
          {Object.entries(display).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-black/20 rounded px-2 py-1">
              <span className="text-gray-400 text-[10px]">{k.replace(/_/g, ' ')}</span>
              <span className="text-emerald-400 text-[10px] font-bold">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </Toggle>
  );
}

function DisasterSection() {
  const [disaster_type, setType] = useState('flood');
  const [affected_population, setPop] = useState('5000');
  const [location, setLoc] = useState('Lusaka');
  const [intensity, setIntensity] = useState('0.6');
  const [enrich, setEnrich] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await emergingAPI.disaster({
        hazard_type: disaster_type,
        affected_population: +affected_population,
        location,
        intensity: +intensity,
        enrich_with_ai: enrich,
      });
      setResult(r);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const severity = result?.severity as string | undefined;
  const phases = result?.response_phases as { phase: number; hour_offset: number; action: string }[] | undefined;
  const resources = result?.resource_estimate as Record<string, number> | undefined;
  const risks = result?.key_risks as string[] | undefined;
  const actions = result?.priority_actions as string[] | undefined;
  const sevColor = severity === 'catastrophic' || severity === 'severe' ? 'text-red-400' : severity === 'moderate' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <Toggle label="Disaster Response Plan">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Hazard type">
          <select value={disaster_type} onChange={e => setType(e.target.value)} className={inputCls}>
            <option value="flood">Flood</option>
            <option value="earthquake">Earthquake</option>
            <option value="fire">Fire</option>
            <option value="storm">Storm</option>
            <option value="drought">Drought</option>
          </select>
        </Field>
        <Field label="Affected population"><input type="number" value={affected_population} onChange={e => setPop(e.target.value)} className={inputCls} /></Field>
        <Field label="Location"><input type="text" value={location} onChange={e => setLoc(e.target.value)} className={inputCls} /></Field>
        <Field label="Intensity (0-1)"><input type="number" step="0.1" min="0" max="1" value={intensity} onChange={e => setIntensity(e.target.value)} className={inputCls} /></Field>
      </div>
      <label className="flex items-center gap-2 text-[10px] text-gray-400">
        <input type="checkbox" checked={enrich} onChange={e => setEnrich(e.target.checked)} />
        Enrich with AI (requires ANTHROPIC_API_KEY)
      </label>
      <button type="button" onClick={run} disabled={loading} className={btnCls}>{loading ? 'Planning…' : 'Generate Response Plan'}</button>
      <ErrorMsg msg={err} />
      {severity && (
        <p className="text-[10px] mt-1">Severity: <span className={`${sevColor} font-bold uppercase`}>{severity}</span></p>
      )}
      {phases && phases.length > 0 && (
        <div className="mt-1 space-y-0.5">
          <p className="text-gray-400 text-[10px] font-semibold uppercase">Response Timeline</p>
          {phases.map((p) => (
            <div key={p.phase} className="flex gap-2 text-[10px] text-gray-300 bg-black/20 rounded px-2 py-1">
              <span className="text-infra-accent font-bold whitespace-nowrap">+{p.hour_offset}h</span><span>{p.action}</span>
            </div>
          ))}
        </div>
      )}
      {resources && (
        <div className="grid grid-cols-2 gap-1 mt-1">
          {Object.entries(resources).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-black/20 rounded px-2 py-1">
              <span className="text-gray-400 text-[10px]">{k.replace(/_/g, ' ')}</span>
              <span className="text-emerald-400 text-[10px] font-bold">{v.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {risks && risks.length > 0 && (
        <p className="text-amber-400/80 text-[10px] mt-1">Key risks: {risks.join(', ')}</p>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-1 space-y-0.5">
          <p className="text-gray-400 text-[10px] font-semibold uppercase">AI Priority Actions</p>
          {actions.map((a, i) => (
            <div key={i} className="flex gap-2 text-[10px] text-gray-300 bg-black/20 rounded px-2 py-1">
              <span className="text-infra-accent font-bold">{i + 1}.</span><span>{a}</span>
            </div>
          ))}
        </div>
      )}
    </Toggle>
  );
}

function DroneSection() {
  const [area_ha, setArea] = useState('2.0');
  const [altitude_m, setAlt] = useState('120');
  const [overlap_pct, setOverlap] = useState('80');
  const [gsd_cm, setGsd] = useState('3');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await emergingAPI.drone({ area_ha: +area_ha, altitude_m: +altitude_m, overlap_pct: +overlap_pct, gsd_cm: +gsd_cm });
      setResult(r);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const keys = ['estimated_photos', 'flight_time_min', 'storage_gb', 'accuracy_cm', 'point_cloud_density'];
  const display = result ? Object.fromEntries(keys.filter(k => k in result).map(k => [k, result[k]])) : null;

  return (
    <Toggle label="Drone Photogrammetry">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Survey area (ha)"><input type="number" step="0.1" value={area_ha} onChange={e => setArea(e.target.value)} className={inputCls} /></Field>
        <Field label="Flight altitude (m)"><input type="number" value={altitude_m} onChange={e => setAlt(e.target.value)} className={inputCls} /></Field>
        <Field label="Overlap (%)"><input type="number" value={overlap_pct} onChange={e => setOverlap(e.target.value)} className={inputCls} /></Field>
        <Field label="GSD (cm)"><input type="number" step="0.5" value={gsd_cm} onChange={e => setGsd(e.target.value)} className={inputCls} /></Field>
      </div>
      <button type="button" onClick={run} disabled={loading} className={btnCls}>{loading ? 'Processing…' : 'Process Survey'}</button>
      <ErrorMsg msg={err} />
      {display && (
        <div className="grid grid-cols-2 gap-1 mt-1">
          {Object.entries(display).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-black/20 rounded px-2 py-1">
              <span className="text-gray-400 text-[10px]">{k.replace(/_/g, ' ')}</span>
              <span className="text-sky-400 text-[10px] font-bold">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </Toggle>
  );
}

function BlockchainSection() {
  const [document_type, setDocType] = useState('calculation');
  const [reference, setRef] = useState('');
  const [description, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await emergingAPI.blockchain({ document_type, reference, description });
      setResult(r);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const keys = ['hash', 'timestamp', 'chain', 'status'];
  const display = result ? Object.fromEntries(keys.filter(k => k in result).map(k => [k, result[k]])) : null;

  return (
    <Toggle label="Blockchain Document Anchoring">
      <Field label="Document type">
        <select value={document_type} onChange={e => setDocType(e.target.value)} className={inputCls}>
          <option value="calculation">Calculation</option>
          <option value="tender">Tender</option>
          <option value="certificate">Certificate</option>
          <option value="drawing">Drawing</option>
        </select>
      </Field>
      <Field label="Reference"><input type="text" value={reference} onChange={e => setRef(e.target.value)} placeholder="e.g. CALC-2024-001" className={inputCls} /></Field>
      <Field label="Description"><input type="text" value={description} onChange={e => setDesc(e.target.value)} placeholder="Brief document description" className={inputCls} /></Field>
      <button type="button" onClick={run} disabled={loading} className={btnCls}>{loading ? 'Anchoring…' : 'Anchor to Blockchain'}</button>
      <ErrorMsg msg={err} />
      {display && (
        <div className="mt-1 space-y-0.5">
          {Object.entries(display).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-black/20 rounded px-2 py-1">
              <span className="text-gray-400 text-[10px]">{k}</span>
              <span className="text-amber-400 text-[10px] font-mono truncate max-w-[60%]">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </Toggle>
  );
}

function CVSafetySection() {
  const [site_type, setSiteType] = useState('construction');
  const [worker_count, setWorkers] = useState('10');
  const [activities, setActivities] = useState('General construction');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await emergingAPI.cvSafety({ site_type, worker_count: +worker_count, activities });
      setResult(r);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const risk = result?.risk_level as string | undefined;
  const violations = result?.violations as string[] | undefined;
  const recommendations = result?.recommendations as string[] | undefined;

  const riskColor = risk === 'high' || risk === 'critical' ? 'text-red-400' : risk === 'medium' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <Toggle label="CV Safety Scan">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Site type">
          <select value={site_type} onChange={e => setSiteType(e.target.value)} className={inputCls}>
            <option value="construction">Construction</option>
            <option value="demolition">Demolition</option>
            <option value="confined_space">Confined Space</option>
            <option value="height_work">Height Work</option>
          </select>
        </Field>
        <Field label="Worker count"><input type="number" value={worker_count} onChange={e => setWorkers(e.target.value)} className={inputCls} /></Field>
        <div className="col-span-2">
          <Field label="Activities"><input type="text" value={activities} onChange={e => setActivities(e.target.value)} className={inputCls} /></Field>
        </div>
      </div>
      <button type="button" onClick={run} disabled={loading} className={btnCls}>{loading ? 'Scanning…' : 'Run Safety Scan'}</button>
      <ErrorMsg msg={err} />
      {risk && <p className={`text-[10px] font-bold mt-1 ${riskColor}`}>Risk level: {risk.toUpperCase()}</p>}
      {violations && violations.length > 0 && (
        <div className="mt-1 space-y-0.5">
          <p className="text-red-400 text-[10px] font-semibold uppercase">Violations</p>
          {violations.map((v, i) => <div key={i} className="text-[10px] text-red-300 bg-red-900/20 rounded px-2 py-1">{v}</div>)}
        </div>
      )}
      {recommendations && recommendations.length > 0 && (
        <div className="mt-1 space-y-0.5">
          <p className="text-emerald-400 text-[10px] font-semibold uppercase">Recommendations</p>
          {recommendations.map((r, i) => <div key={i} className="text-[10px] text-emerald-300 bg-emerald-900/20 rounded px-2 py-1">{r}</div>)}
        </div>
      )}
      {result && !risk && !violations && <ResultBox data={result} />}
    </Toggle>
  );
}

function ARSceneSection() {
  const [scene_type, setScene] = useState('structural_overlay');
  const [project_ref, setRef] = useState('PRJ-001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await emergingAPI.arScene({ scene_type, project_ref });
      setResult(r);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const markers = result?.ar_markers as unknown[] | undefined;
  const layers = result?.overlay_layers;
  const instructions = result?.instructions as string | undefined;

  return (
    <Toggle label="AR Mobile Scene">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Scene type">
          <select value={scene_type} onChange={e => setScene(e.target.value)} className={inputCls}>
            <option value="structural_overlay">Structural Overlay</option>
            <option value="utility_mapping">Utility Mapping</option>
            <option value="progress_check">Progress Check</option>
          </select>
        </Field>
        <Field label="Project ref"><input type="text" value={project_ref} onChange={e => setRef(e.target.value)} className={inputCls} /></Field>
      </div>
      <button type="button" onClick={run} disabled={loading} className={btnCls}>{loading ? 'Building scene…' : 'Build AR Scene'}</button>
      <ErrorMsg msg={err} />
      {instructions && <p className="text-gray-300 text-[10px] mt-1 italic">{instructions}</p>}
      {layers !== undefined && (
        <div className="flex justify-between bg-black/20 rounded px-2 py-1 mt-1">
          <span className="text-gray-400 text-[10px]">overlay layers</span>
          <span className="text-sky-400 text-[10px] font-bold">{String(layers)}</span>
        </div>
      )}
      {markers && markers.length > 0 && (
        <div className="mt-1">
          <p className="text-gray-400 text-[10px] font-semibold uppercase mb-0.5">AR Markers</p>
          <pre className={resultsCls}>{JSON.stringify(markers, null, 2)}</pre>
        </div>
      )}
      {result && !instructions && !layers && !markers && <ResultBox data={result} />}
    </Toggle>
  );
}

function SeismicSection() {
  const [analysis_type, setAnalysis] = useState('modal');
  const [pga_g, setPga] = useState('0.04');
  const [n_storeys, setStoreys] = useState('4');
  const [storey_height_m, setHeight] = useState('3.0');
  const [site_class, setSite] = useState('C');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await emergingAPI.seismic({ analysis_type, pga_g: +pga_g, n_storeys: +n_storeys, storey_height_m: +storey_height_m, site_class });
      setResult(r);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const summaryKeys = ['base_shear_kn', 'max_displacement_mm', 'fundamental_period_s', 'damage_state'];
  const summary = result ? Object.fromEntries(summaryKeys.filter(k => k in result).map(k => [k, result[k]])) : null;
  const modes = result?.modes as Record<string, unknown>[] | undefined;

  const dmgColor = (s: string) => s === 'none' ? 'text-emerald-400' : s === 'minor' ? 'text-yellow-400' : s === 'moderate' ? 'text-amber-400' : 'text-red-400';

  return (
    <Toggle label="Seismic Response Simulation">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Analysis type">
          <select value={analysis_type} onChange={e => setAnalysis(e.target.value)} className={inputCls}>
            <option value="modal">Modal</option>
            <option value="time_history">Time History</option>
            <option value="pushover">Pushover</option>
          </select>
        </Field>
        <Field label="PGA (g)"><input type="number" step="0.01" value={pga_g} onChange={e => setPga(e.target.value)} className={inputCls} /></Field>
        <Field label="No. of storeys"><input type="number" value={n_storeys} onChange={e => setStoreys(e.target.value)} className={inputCls} /></Field>
        <Field label="Storey height (m)"><input type="number" step="0.1" value={storey_height_m} onChange={e => setHeight(e.target.value)} className={inputCls} /></Field>
        <Field label="Site class">
          <select value={site_class} onChange={e => setSite(e.target.value)} className={inputCls}>
            {['A', 'B', 'C', 'D', 'E'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <button type="button" onClick={run} disabled={loading} className={btnCls}>{loading ? 'Analysing…' : 'Run Seismic Analysis'}</button>
      <ErrorMsg msg={err} />
      {summary && (
        <div className="grid grid-cols-2 gap-1 mt-1">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-black/20 rounded px-2 py-1">
              <span className="text-gray-400 text-[10px]">{k.replace(/_/g, ' ')}</span>
              <span className={`text-[10px] font-bold ${k === 'damage_state' ? dmgColor(String(v)) : 'text-violet-400'}`}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {modes && modes.length > 0 && (
        <div className="mt-1 overflow-x-auto">
          <p className="text-gray-400 text-[10px] font-semibold uppercase mb-0.5">Mode Table</p>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-gray-500 border-b border-infra-accent/20">
                {Object.keys(modes[0]).map(h => <th key={h} className="text-left px-1 py-0.5">{h.replace(/_/g, ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {modes.map((row, i) => (
                <tr key={i} className="border-b border-infra-accent/10 text-gray-300">
                  {Object.values(row).map((v, j) => <td key={j} className="px-1 py-0.5">{String(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Toggle>
  );
}

export function EmergingTechPanel() {
  const [marketplace, setMarketplace] = useState<Record<string, unknown> | null>(null);
  const [mktType, setMktType] = useState('');
  const [satellite, setSatellite] = useState<Record<string, unknown> | null>(null);
  const [satLoading, setSatLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('material');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('unit');

  const loadMarket = (type = mktType) => {
    emergingAPI.marketplace('ZM', { type: type || undefined }).then(setMarketplace).catch(() => null);
  };

  useEffect(() => {
    loadMarket('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addListing = async () => {
    if (!newTitle || !newPrice) return;
    await emergingAPI.createListing({
      type: newType, title: newTitle, price_usd: +newPrice, unit: newUnit, region: 'ZM',
    }).catch(() => null);
    setNewTitle(''); setNewPrice(''); setShowAdd(false);
    loadMarket();
  };

  const removeListing = async (id: string) => {
    await emergingAPI.deleteListing(id).catch(() => null);
    loadMarket();
  };

  const runSatellite = async () => {
    setSatLoading(true);
    try {
      const r = await emergingAPI.satellite({ latitude: -15.3875, longitude: 28.3228 });
      setSatellite(r);
    } finally { setSatLoading(false); }
  };

  const listings = (marketplace?.listings as Record<string, unknown>[]) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Emerging Technology</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        <CapabilitiesBanner />
        <div className={sectionCls}>
          <p className={`${summaryBaseCls} cursor-default`}>Marketplace ({listings.length})</p>
          <div className="px-3 pb-3 pt-1 space-y-2">
            <div className="flex gap-2">
              <select
                value={mktType}
                onChange={(e) => { setMktType(e.target.value); loadMarket(e.target.value); }}
                className={inputCls}
              >
                <option value="">All types</option>
                <option value="material">Material</option>
                <option value="labour">Labour</option>
                <option value="equipment">Equipment</option>
                <option value="carbon_credit">Carbon credit</option>
                <option value="service">Service</option>
              </select>
              <button type="button" onClick={() => setShowAdd((s) => !s)} className="px-2 py-1 text-[10px] bg-infra-accent/30 rounded text-white whitespace-nowrap">
                {showAdd ? 'Cancel' : '+ Add'}
              </button>
            </div>
            {showAdd && (
              <div className="space-y-1.5 bg-black/20 rounded p-2">
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" className={inputCls} />
                <div className="grid grid-cols-3 gap-1.5">
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} className={inputCls}>
                    <option value="material">Material</option>
                    <option value="labour">Labour</option>
                    <option value="equipment">Equipment</option>
                    <option value="carbon_credit">Carbon</option>
                    <option value="service">Service</option>
                  </select>
                  <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="USD" className={inputCls} />
                  <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="unit" className={inputCls} />
                </div>
                <button type="button" onClick={addListing} className={btnCls}>Save listing</button>
              </div>
            )}
            {listings.length === 0 && <p className="text-gray-500 text-[10px]">No listings.</p>}
            {listings.map((l) => (
              <div key={String(l.id)} className="flex items-center justify-between py-1.5 border-b border-infra-accent/10 text-gray-300">
                <span className="flex-1 truncate">{String(l.title)}</span>
                <span className="text-emerald-400 mx-2">${String(l.price_usd)}/{String(l.unit)}</span>
                <button type="button" onClick={() => removeListing(String(l.id))} className="text-red-400/70 hover:text-red-400 text-[11px]" title="Remove">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCls}>
          <p className={`${summaryBaseCls} cursor-default`}>Satellite AI</p>
          <div className="px-3 pb-3 pt-1 space-y-2">
            <button type="button" onClick={runSatellite} disabled={satLoading} className={btnCls}>
              {satLoading ? 'Analysing…' : 'Run land-cover analysis (Lusaka demo)'}
            </button>
            {satellite && (
              <pre className={resultsCls}>{JSON.stringify(satellite.land_cover, null, 2)}</pre>
            )}
          </div>
        </div>

        <ThermalSection />
        <DisasterSection />
        <DroneSection />
        <BlockchainSection />
        <CVSafetySection />
        <ARSceneSection />
        <SeismicSection />
      </div>
    </div>
  );
}
