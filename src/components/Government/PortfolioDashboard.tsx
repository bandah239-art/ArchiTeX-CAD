import { useEffect } from 'react';
import { useGovernmentStore } from '../../store/governmentStore';
import { ProjectTracker } from './ProjectTracker';

function SCurveChart({ planned, actual }: { planned: { month: number; planned_pct: number }[]; actual: { month: number; actual_pct: number }[] }) {
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

export function PortfolioDashboard() {
  const { portfolio, isLoading, error, view, loadPortfolio, selectProject, setView, seedDemo } = useGovernmentStore();

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  if (view === 'project') {
    return <ProjectTracker onBack={() => setView('portfolio')} />;
  }

  const summary = portfolio?.summary as Record<string, number> | undefined;
  const projects = (portfolio?.projects as Record<string, unknown>[]) ?? [];
  const alerts = (portfolio?.alerts as Record<string, unknown>[]) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Government Portfolio</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <button type="button" onClick={() => seedDemo()} className="w-full py-1.5 text-xs border border-infra-accent/50 rounded">
          Load Demo Portfolio
        </button>

        {isLoading && <div className="text-xs text-gray-400">Loading...</div>}
        {error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{error}</div>}

        {summary && (
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Projects" value={String(summary.total_projects)} />
            <Kpi label="Active" value={String(summary.active_projects)} />
            <Kpi label="Portfolio USD" value={`${(summary.total_contract_value_usd / 1e6).toFixed(1)}M`} />
            <Kpi label="Avg Complete" value={`${summary.average_completion_pct}%`} />
            <Kpi label="On Schedule" value={String(summary.projects_on_schedule)} />
            <Kpi label="Delayed" value={String(summary.projects_delayed)} />
          </div>
        )}

        {alerts.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-400 uppercase">Alerts</div>
            {alerts.map((a) => (
              <div key={String(a.project_id)} className="p-2 bg-infra-darker border border-infra-accent/30 rounded text-xs text-gray-300">
                <span className={a.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}>{String(a.severity)}</span>
                {' — '}{String(a.project_name)}: {String(a.message)}
              </div>
            ))}
          </div>
        )}

        <div className="text-xs font-semibold text-gray-400 uppercase">Project Matrix</div>
        {projects.map((p) => (
          <button
            key={String(p.id)}
            type="button"
            onClick={() => selectProject(String(p.id))}
            className="w-full p-3 bg-infra-darker border border-infra-accent/30 rounded text-left text-xs text-gray-300 hover:border-infra-highlight/50"
          >
            <div className="text-white font-medium">{String(p.project_name)}</div>
            <div className="flex justify-between mt-1">
              <span>{String(p.project_type)} · {String(p.province)}</span>
              <span>{Number(p.completion_pct)}%</span>
            </div>
            <div className="mt-1 h-1.5 bg-infra-accent/30 rounded overflow-hidden">
              <div className="h-full bg-infra-highlight" style={{ width: `${Number(p.completion_pct)}%` }} />
            </div>
          </button>
        ))}

        {portfolio?.by_funding_source ? (
          <div className="text-xs text-gray-500 pt-2">
            Funding:{' '}
            {Object.entries(portfolio.by_funding_source as Record<string, { count: number }>)
              .map(([k, v]) => `${k} (${v.count})`)
              .join(' · ')}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-infra-darker border border-infra-accent/30 rounded text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

export { SCurveChart };
