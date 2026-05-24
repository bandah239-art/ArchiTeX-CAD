import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useScheduleStore } from '../../store/scheduleStore';

export function SchedulePanel() {
  const { t } = useTranslation();
  const {
    schedule,
    currentWeek,
    isPlaying,
    playbackMs,
    timelineEnabled,
    isBuilding,
    buildFromBim,
    setCurrentWeek,
    setTimelineEnabled,
    play,
    pause,
    tickPlayback,
    getCumulativeCost,
    error,
  } = useScheduleStore();

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(tickPlayback, playbackMs);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackMs, tickPlayback]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t('schedule.title')}</h2>
        <button
          type="button"
          onClick={() => buildFromBim()}
          disabled={isBuilding}
          className="mt-2 w-full py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 rounded disabled:opacity-50"
        >
          {isBuilding ? '…' : t('schedule.build')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && <div className="text-xs text-red-300">{error}</div>}

        {schedule && (
          <>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-infra-darker rounded p-2">
                <div className="text-lg font-bold text-white">Wk {currentWeek}</div>
                <div className="text-[9px] text-gray-500 uppercase">4D Timeline</div>
              </div>
              <div className="bg-infra-darker rounded p-2">
                <div className="text-lg font-bold text-emerald-400">
                  ${getCumulativeCost().toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[9px] text-gray-500 uppercase">5D Cost to date</div>
              </div>
            </div>

            <div className="p-3 bg-infra-darker border border-emerald-500/30 rounded space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timelineEnabled}
                    onChange={(e) => setTimelineEnabled(e.target.checked)}
                  />
                  4D Viewer playback
                </label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => (isPlaying ? pause() : play())} className="px-2 py-0.5 text-xs border border-infra-accent/40 rounded">
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button type="button" onClick={() => setCurrentWeek(0)} className="px-2 py-0.5 text-xs border border-infra-accent/40 rounded">
                    ↺
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={schedule.duration_weeks}
                value={currentWeek}
                onChange={(e) => setCurrentWeek(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Week 0</span>
                <span>Week {schedule.duration_weeks}</span>
              </div>
            </div>

            <div className="space-y-1">
              {schedule.activities.map((a) => {
                const end = a.start_week + a.duration_weeks;
                const active = currentWeek >= a.start_week && currentWeek <= end;
                const done = currentWeek > end;
                return (
                  <div
                    key={a.id}
                    className={`text-xs border rounded px-2 py-1.5 ${
                      active
                        ? 'bg-emerald-900/30 border-emerald-500/50'
                        : done
                          ? 'bg-infra-darker/60 border-infra-accent/20'
                          : 'bg-infra-darker/30 border-infra-accent/10 opacity-50'
                    }`}
                  >
                    <div className="text-gray-200 font-medium">{a.name}</div>
                    <div className="text-gray-500 mt-0.5">
                      Wk {a.start_week}–{end} · ${a.cost_usd.toLocaleString()}
                      {active && <span className="text-emerald-400 ml-1">● building</span>}
                      {done && <span className="text-gray-400 ml-1">✓ complete</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!schedule && !isBuilding && (
          <p className="text-xs text-gray-500">Load an IFC model and build schedule from BIM quantities.</p>
        )}
      </div>
    </div>
  );
}
