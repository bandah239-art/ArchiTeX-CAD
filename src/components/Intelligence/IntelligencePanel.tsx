import { useEffect } from 'react';
import { useIntelligenceStore } from '../../store/intelligenceStore';

export function IntelligencePanel() {
  const {
    portfolio,
    collabStatus,
    wsConnected,
    liveEvents,
    isLoading,
    error,
    loadPortfolio,
    loadCollab,
    joinCollab,
    disconnectLiveCollab,
    seedTwin,
  } = useIntelligenceStore();

  useEffect(() => {
    loadPortfolio();
    loadCollab();
    return () => disconnectLiveCollab();
  }, [loadPortfolio, loadCollab, disconnectLiveCollab]);

  const assets = (portfolio?.assets as Record<string, unknown>[]) ?? [];
  const recentEvents = (collabStatus?.recent_events as Record<string, unknown>[]) ?? liveEvents;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Digital Twin & AI</h2>
        <p className="text-xs text-gray-500 mt-1">Tier 3 — IoT sensors + predictive maintenance</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => seedTwin()} className="flex-1 py-1.5 text-xs border border-infra-accent/50 rounded">Seed Demo Assets</button>
          <button type="button" onClick={() => joinCollab()} className="flex-1 py-1.5 text-xs border border-infra-accent/50 rounded">Join Live Room</button>
        </div>

        {collabStatus && (
          <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 uppercase">Collaboration</span>
              <span className={wsConnected ? 'text-green-400' : 'text-gray-500'}>
                {wsConnected ? '● Live WS' : '○ REST only'}
              </span>
            </div>
            <div className="text-white">{Number(collabStatus.user_count ?? 0)} user(s) online</div>
          </div>
        )}

        {recentEvents.length > 0 && (
          <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs space-y-1 max-h-32 overflow-y-auto">
            <div className="text-gray-400 uppercase mb-1">Recent activity</div>
            {recentEvents.slice(-5).reverse().map((ev, i) => (
              <div key={String(ev.id ?? i)} className="text-gray-300 truncate">
                {String(ev.type)} — {JSON.stringify(ev.payload ?? {}).slice(0, 60)}
              </div>
            ))}
          </div>
        )}

        {isLoading && <div className="text-xs text-gray-400">Loading...</div>}
        {error && <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">{error}</div>}

        {portfolio && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Kpi label="Healthy" value={String(portfolio.healthy ?? 0)} color="text-green-400" />
            <Kpi label="Attention" value={String(portfolio.attention ?? 0)} color="text-yellow-400" />
            <Kpi label="Critical" value={String(portfolio.critical ?? 0)} color="text-red-400" />
          </div>
        )}

        {assets.map((a) => (
          <div key={String(a.asset_id)} className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-xs">
            <div className="text-white font-medium">{String(a.asset_name)}</div>
            <div className="flex justify-between mt-2">
              <span className="text-gray-500">Health score</span>
              <span className={healthColor(Number(a.health_score))}>{Number(a.health_score)}/100</span>
            </div>
            <div className="text-gray-400 mt-1">{String(a.overall_status)} — {String(a.recommendation)}</div>
            {(a.alerts as unknown[])?.length > 0 && (
              <div className="text-yellow-400 mt-1">{(a.alerts as unknown[]).length} alert(s)</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-2 bg-infra-darker border border-infra-accent/30 rounded">
      <div className="text-gray-500">{label}</div>
      <div className={`font-bold ${color}`}>{value}</div>
    </div>
  );
}

function healthColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}
