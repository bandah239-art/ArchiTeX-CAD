import { useEffect, useState } from 'react';
import { emergingAPI } from '../../services/emergingAPI';

export function EmergingTechPanel() {
  const [marketplace, setMarketplace] = useState<Record<string, unknown> | null>(null);
  const [satellite, setSatellite] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    emergingAPI.marketplace('ZM').then(setMarketplace).catch(() => null);
  }, []);

  const runSatellite = async () => {
    setLoading(true);
    try {
      const r = await emergingAPI.satellite({ latitude: -15.3875, longitude: 28.3228 });
      setSatellite(r);
    } finally {
      setLoading(false);
    }
  };

  const listings = (marketplace?.listings as Record<string, unknown>[]) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Emerging Technology</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <section>
          <h3 className="text-gray-400 uppercase font-semibold mb-2">Marketplace</h3>
          {listings.map((l) => (
            <div key={String(l.id)} className="flex justify-between py-1.5 border-b border-infra-accent/10 text-gray-300">
              <span>{String(l.title)}</span>
              <span className="text-emerald-400">${String(l.price_usd)}/{String(l.unit)}</span>
            </div>
          ))}
        </section>

        <section>
          <h3 className="text-gray-400 uppercase font-semibold mb-2">Satellite AI</h3>
          <button type="button" onClick={runSatellite} disabled={loading} className="w-full py-1.5 border border-infra-accent/40 rounded mb-2">
            {loading ? 'Analysing…' : 'Run land-cover analysis (Lusaka demo)'}
          </button>
          {satellite && (
            <pre className="p-2 bg-infra-darker rounded text-[10px] text-gray-400 overflow-x-auto">
              {JSON.stringify(satellite.land_cover, null, 2)}
            </pre>
          )}
        </section>

        <section className="text-gray-500 space-y-1">
          <div>⛓ Blockchain anchoring — POST /emerging/blockchain/anchor</div>
          <div>🆘 Disaster response — POST /emerging/disaster/plan</div>
          <div>🚁 Drone photogrammetry — POST /emerging/drone/process</div>
          <div>🎤 Voice control — POST /emerging/voice/command</div>
          <div>👷 CV safety — POST /emerging/cv/safety</div>
          <div>📱 AR mobile — POST /emerging/ar/scene</div>
          <div>🌡 Thermal sim — POST /simulate/thermal</div>
          <div>📳 Seismic sim — POST /simulate/seismic</div>
        </section>
      </div>
    </div>
  );
}
