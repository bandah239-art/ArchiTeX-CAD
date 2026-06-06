import { useEffect } from 'react';
import { useGovernmentStore } from '../../store/governmentStore';
import { ProjectTracker } from './ProjectTracker';
import { ProjectRegisterForm } from './ProjectRegisterForm';

export function SCurveChart({ planned, actual }: { planned: { month: number; planned_pct: number }[]; actual: { month: number; actual_pct: number }[] }) {
  const maxMonth = Math.max(planned.length - 1, ...actual.map((a) => a.month), 1);
  const w = 280;
  const h = 80;
  const pt = (month: number, pct: number) => `${(month / maxMonth) * w},${h - (pct / 100) * h}`;
  const plannedPath = planned.map((p) => pt(p.month, p.planned_pct)).join(' ');
  const actualPath = actual.map((a) => pt(a.month, a.actual_pct)).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20 bg-infra-darker rounded">
      <polyline fill="none" stroke="#4ade80" strokeWidth="2" points={plannedPath} opacity={0.6} />
      <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={actualPath} />
    </svg>
  );
}

export function EVMChart({ series, budget }: { series: { month: number; PV: number; EV: number; AC: number }[]; budget: number }) {
  const maxMonth = Math.max(...series.map((s) => s.month), 1);
  const maxVal = Math.max(budget, ...series.flatMap((s) => [s.PV, s.EV, s.AC]), 1);
  const w = 280;
  const h = 90;
  const pt = (month: number, val: number) => `${(month / maxMonth) * w},${h - (val / maxVal) * h}`;
  const pvPath = series.map((s) => pt(s.month, s.PV)).join(' ');
  const evPath = series.filter((s) => s.EV > 0).map((s) => pt(s.month, s.EV)).join(' ');
  const acPath = series.filter((s) => s.AC > 0).map((s) => pt(s.month, s.AC)).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 bg-infra-darker rounded">
        <polyline fill="none" stroke="#4ade80" strokeWidth="1.5" points={pvPath} opacity={0.7} />
        <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={evPath} />
        <polyline fill="none" stroke="#f59e0b" strokeWidth="2" points={acPath} />
      </svg>
      <div className="flex gap-3 text-[9px] text-gray-500 mt-1">
        <span className="text-green-400">— PV</span>
        <span className="text-blue-400">— EV</span>
        <span className="text-amber-400">— AC</span>
      </div>
    </div>
  );
}

export function PortfolioDashboard() {
  const {
    portfolio, isLoading, error, view, filters,
    loadPortfolio, selectProject, setView, seedDemo, setFilters, exportRegister,
  } = useGovernmentStore();

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  if (view === 'project') {
    return <ProjectTracker onBack={() => setView('portfolio')} />;
  }

  if (view === 'register') {
    return (
      <div className="flex flex-col h-full p-4 overflow-y-auto">
        <ProjectRegisterForm onCancel={() => setView('portfolio')} />
      </div>
    );
  }

  const summary = portfolio?.summary as Record<string, number> | undefined;
  const allProjects = (portfolio?.projects as Record<string, unknown>[]) ?? [];
  const alerts = (portfolio?.alerts as Record<string, unknown>[]) ?? [];

  const projects = allProjects.filter((p) => {
    if (filters.status && p.status !== filters.status) return false;
    if (filters.province && p.province !== filters.province) return false;
    if (filters.project_type && p.project_type !== filters.project_type) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const name = String(p.project_name ?? '').toLowerCase();
      const code = String(p.project_code ?? '').toLowerCase();
      if (!name.includes(q) && !code.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Government Portfolio</h2>
        <p className="text-[10px] text-gray-500 mt-0.5">Project register · EVM · Payment certificates</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setView('register')} className="flex-1 py-1.5 text-xs bg-infra-highlight text-white rounded font-semibold">
            + Register Project
          </button>
          <button type="button" onClick={() => exportRegister()} className="flex-1 py-1.5 text-xs border border-infra-accent/50 rounded">
            Export CSV
          </button>
        </div>
        <button type="button" onClick={() => seedDemo()} className="w-full py-1.5 text-xs border border-infra-accent/50 rounded">
          Load Demo Portfolio
        </button>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Search projects…"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="col-span-2 px-2 py-1 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white"
          />
          <select value={filters.province} onChange={(e) => setFilters({ province: e.target.value })} className="px-2 py-1 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white">
            <option value="">All provinces</option>
            {['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })} className="px-2 py-1 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white">
            <option value="">All statuses</option>
            {['feasibility', 'design', 'tender', 'construction', 'defects', 'closed'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {isLoading && <div className="text-xs text-gray-400">Loading...</div>}
        {error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{error}</div>}

        {summary && (
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Projects" value={String(summary.total_projects)} />
            <Kpi label="Active" value={String(summary.active_projects)} />
            <Kpi label="Portfolio USD" value={`${(summary.total_contract_value_usd / 1e6).toFixed(1)}M`} />
            <Kpi label="Avg Complete" value={`${summary.average_completion_pct}%`} />
            <Kpi label="Portfolio CPI" value={String(summary.cost_performance_index)} alert={Number(summary.cost_performance_index) < 0.85} />
            <Kpi label="Portfolio SPI" value={String(summary.schedule_performance_index)} alert={Number(summary.schedule_performance_index) < 0.85} />
          </div>
        )}

        {alerts.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-400 uppercase">Alerts</div>
            {alerts.map((a) => (
              <div key={String(a.project_id) + String(a.message)} className="p-2 bg-infra-darker border border-infra-accent/30 rounded text-xs text-gray-300">
                <span className={a.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}>{String(a.severity)}</span>
                {' — '}{String(a.project_name)}: {String(a.message)}
              </div>
            ))}
          </div>
        )}

        <div className="text-xs font-semibold text-gray-400 uppercase">Project Register ({projects.length})</div>
        {projects.map((p) => {
          const evm = p.evm as Record<string, unknown> | undefined;
          return (
            <button
              key={String(p.id)}
              type="button"
              onClick={() => selectProject(String(p.id))}
              className="w-full p-3 bg-infra-darker border border-infra-accent/30 rounded text-left text-xs text-gray-300 hover:border-infra-highlight/50"
            >
              <div className="flex justify-between">
                <span className="text-white font-medium">{String(p.project_name)}</span>
                <span className="text-[10px] text-gray-500">{String(p.project_code)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>{String(p.project_type)} · {String(p.province)} · {String(p.status)}</span>
                <span>{Number(p.completion_pct)}%</span>
              </div>
              {evm && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  CPI {String(evm.CPI)} · SPI {String(evm.SPI)} · {String(evm.status)}
                </div>
              )}
              <div className="mt-1 h-1.5 bg-infra-accent/30 rounded overflow-hidden">
                <div className="h-full bg-infra-highlight" style={{ width: `${Number(p.completion_pct)}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`p-2 border rounded text-center ${alert ? 'bg-red-950/30 border-red-500/40' : 'bg-infra-darker border-infra-accent/30'}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-bold ${alert ? 'text-red-300' : 'text-white'}`}>{value}</div>
    </div>
  );
}
