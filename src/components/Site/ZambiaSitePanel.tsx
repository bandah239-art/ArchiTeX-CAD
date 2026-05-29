import { useState } from 'react';

interface ZambiaSitePanelProps {
  onApplySiteData?: (data: { windSpeed: number; pga: number; soilType: string }) => void;
}

export function ZambiaSitePanel({ onApplySiteData }: ZambiaSitePanelProps) {
  const [lat, setLat] = useState('-15.42');
  const [lon, setLon] = useState('28.28');
  const [selectedProvince, setSelectedProvince] = useState('Lusaka');
  const [siteData, setSiteData] = useState<any>({
    closest_city: 'Lusaka',
    province: 'Lusaka',
    wind_speed: 24,
    pga: 0.04,
    rainfall_10yr: 82.5,
    soil_risk: 'HIGH',
    soil_type: 'CH Expansive Clay (Black Cotton Soil)',
    altitude_m: 1280
  });

  const PROVINCE_DATA: Record<string, any> = {
    Lusaka: { closest_city: 'Lusaka', wind_speed: 24, pga: 0.04, rainfall_10yr: 82.5, soil_risk: 'HIGH', soil_type: 'CH Expansive Clay (Black Cotton)', altitude_m: 1280, lat: '-15.42', lon: '28.28' },
    Copperbelt: { closest_city: 'Ndola', wind_speed: 26, pga: 0.03, rainfall_10yr: 94.0, soil_risk: 'MODERATE', soil_type: 'Lateritic Gravelly Soils', altitude_m: 1300, lat: '-12.97', lon: '28.63' },
    Southern: { closest_city: 'Livingstone', wind_speed: 22, pga: 0.04, rainfall_10yr: 65.2, soil_risk: 'LOW', soil_type: 'Kalahari Sandy Soils', altitude_m: 900, lat: '-17.85', lon: '25.85' },
    Eastern: { closest_city: 'Chipata', wind_speed: 23, pga: 0.05, rainfall_10yr: 78.4, soil_risk: 'LOW', soil_type: 'Quartzite / Weathered Rock', altitude_m: 1030, lat: '-13.63', lon: '32.65' },
    Central: { closest_city: 'Kafue', wind_speed: 25, pga: 0.04, rainfall_10yr: 80.0, soil_risk: 'HIGH', soil_type: 'CH Expansive Clay (Kafue Flats)', altitude_m: 980, lat: '-15.77', lon: '28.18' }
  };

  const handleProvinceSelect = (prov: string) => {
    setSelectedProvince(prov);
    const data = PROVINCE_DATA[prov];
    setLat(data.lat);
    setLon(data.lon);
    setSiteData(data);
  };

  const triggerSearch = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/site/zambia-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: parseFloat(lat), longitude: parseFloat(lon) }),
      });
      const data = await response.json();
      if (data.status === 'ok') {
        setSiteData({
          closest_city: data.region.closest_city,
          province: data.region.province,
          wind_speed: data.wind.zone_speed_ms,
          pga: data.seismic.pga_g,
          rainfall_10yr: data.hydrology.idf_intensity_15min_10yr_mm_hr,
          soil_risk: data.soil_prior.expansion_risk,
          soil_type: data.soil_prior.soil_type,
          altitude_m: data.region.altitude_m
        });
      }
    } catch {
      // Fallback
      handleProvinceSelect(selectedProvince);
    }
  };

  const handleApply = () => {
    if (onApplySiteData) {
      onApplySiteData({
        windSpeed: siteData.wind_speed,
        pga: siteData.pga,
        soilType: siteData.soil_type
      });
      alert('Site parameters applied to active calculators!');
    }
  };

  return (
    <div className="bg-[#1a2238]/90 p-5 rounded-xl border border-infra-accent/30 text-white space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-infra-accent/20">
        <h3 className="text-xs font-bold text-infra-highlight uppercase tracking-wider">Zambia Site Intelligence</h3>
        <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono">ZABS mapping</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Selector & Map */}
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">Province / Region Picker</label>
            <select
              value={selectedProvince}
              onChange={(e) => handleProvinceSelect(e.target.value)}
              className="w-full bg-[#11192e] border border-infra-accent/40 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-infra-highlight"
            >
              {Object.keys(PROVINCE_DATA).map((p) => (
                <option key={p} value={p}>{p} Province</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">Latitude</label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full bg-[#11192e] border border-infra-accent/40 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">Longitude</label>
              <input
                type="text"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="w-full bg-[#11192e] border border-infra-accent/40 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>
            <button
              onClick={triggerSearch}
              className="mt-5 px-3 py-1 bg-infra-highlight text-white text-xs rounded hover:bg-infra-highlight/80 font-bold"
            >
              LOCATE
            </button>
          </div>

          {/* Clickable SVG outline map of Zambia */}
          <div className="bg-[#11192e] p-3 rounded border border-infra-accent/20 flex justify-center items-center h-32 relative">
            <svg viewBox="0 0 200 150" className="w-full h-full text-infra-accent/50 stroke-infra-accent">
              <polygon points="50,90 80,70 120,80 150,60 180,90 150,120 100,130 50,110" fill="#1b253b" strokeWidth="1" className="cursor-pointer hover:fill-infra-highlight/30 transition-colors" onClick={() => handleProvinceSelect('Lusaka')} />
              <circle cx="95" cy="88" r="4" fill="#ef4444" />
              <text x="95" y="80" fill="#fff" fontSize="6" textAnchor="middle" fontWeight="bold">Lusaka</text>
              <circle cx="110" cy="50" r="4" fill="#3b82f6" />
              <text x="110" y="44" fill="#fff" fontSize="6" textAnchor="middle" fontWeight="bold">Ndola</text>
            </svg>
            <span className="absolute bottom-1 right-2 text-[8px] text-gray-500 font-mono">Interactive outline map</span>
          </div>
        </div>

        {/* Right Column: Site Data Card */}
        <div className="bg-[#11192e] p-4 rounded-xl border border-infra-accent/20 space-y-3">
          <h4 className="text-xs font-bold text-gray-300">Local Site Parameters</h4>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#1a2238] p-2 rounded">
              <span className="text-[10px] text-gray-400 block">Wind Zone Speed</span>
              <span className="font-mono text-sm text-sky-400 font-bold">{siteData.wind_speed} m/s</span>
            </div>
            <div className="bg-[#1a2238] p-2 rounded">
              <span className="text-[10px] text-gray-400 block">Seismic PGA</span>
              <span className="font-mono text-sm text-amber-400 font-bold">{siteData.pga}g</span>
            </div>
            <div className="bg-[#1a2238] p-2 rounded col-span-2">
              <span className="text-[10px] text-gray-400 block">10-Year Rain Intensity (15-min)</span>
              <span className="font-mono text-sm text-emerald-400 font-bold">{siteData.rainfall_10yr} mm/hr</span>
            </div>
            <div className="bg-[#1a2238] p-2 rounded col-span-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400">Expansion Soil Risk</span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${siteData.soil_risk === 'HIGH' ? 'bg-red-500/20 text-red-300' : siteData.soil_risk === 'MODERATE' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                  {siteData.soil_risk}
                </span>
              </div>
              <span className="text-xs text-white block mt-0.5 truncate">{siteData.soil_type}</span>
            </div>
            <div className="bg-[#1a2238] p-2 rounded col-span-2">
              <span className="text-[10px] text-gray-400 block">Elevation / Altitude</span>
              <span className="font-mono text-xs text-white">{siteData.altitude_m}m AMSL (No correction needed)</span>
            </div>
          </div>

          <button
            onClick={handleApply}
            className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded-lg shadow hover:bg-infra-highlight/90 transition-all uppercase"
          >
            Use Site Parameters in Active Calculators
          </button>
        </div>
      </div>
    </div>
  );
}
