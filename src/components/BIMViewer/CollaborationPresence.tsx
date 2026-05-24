import { useEffect } from 'react';
import { useIntelligenceStore } from '../../store/intelligenceStore';

export function CollaborationPresence() {
  const { wsConnected, collabStatus, connectLiveCollab } = useIntelligenceStore();
  const users = (collabStatus?.users as { user_name?: string }[] | undefined) ?? [];
  const count = users.length || (wsConnected ? 1 : 0);

  useEffect(() => {
    connectLiveCollab();
  }, [connectLiveCollab]);

  return (
    <div className="absolute top-2 right-36 z-20 flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold backdrop-blur border ${
          wsConnected
            ? 'bg-emerald-900/60 border-emerald-500/50 text-emerald-300'
            : 'bg-gray-900/60 border-gray-600/50 text-gray-400'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
        {wsConnected ? 'LIVE' : 'OFFLINE'} · {count}
      </div>
      {users.slice(0, 4).map((u, i) => (
        <span
          key={i}
          className="w-6 h-6 rounded-full bg-infra-highlight/30 border border-infra-highlight/50 text-[9px] flex items-center justify-center text-white"
          title={u.user_name}
        >
          {(u.user_name ?? 'U')[0].toUpperCase()}
        </span>
      ))}
    </div>
  );
}
