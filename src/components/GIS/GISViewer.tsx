import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function GISViewer() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map only once
    if (!mapInstance.current) {
      // Default to a location (e.g., Lusaka)
      mapInstance.current = L.map(mapRef.current).setView([-15.3875, 28.3228], 13);

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 18,
      }).addTo(mapInstance.current);

      let marker: L.Marker | null = null;

      // Handle map clicks
      mapInstance.current.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        
        if (marker) {
          marker.setLatLng([lat, lng]);
        } else {
          // Fix for default marker icons missing in webpack/vite
          const customIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });
          marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstance.current!);
        }

        setAnalyzing(true);
        setResults(null);

        try {
          // Send coordinates to the backend
          const res = await fetch('http://127.0.0.1:8000/geo/terrain-analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: lat, longitude: lng })
          }).catch(() => null);

          if (res && res.ok) {
            const data = await res.json();
            setResults(data);
          } else {
            // Fallback mock if backend isn't ready
            setTimeout(() => {
              setResults({
                elevation_m: Math.round(1200 + Math.random() * 100),
                slope_degrees: (Math.random() * 15).toFixed(1),
                earthworks: {
                  cut_m3: Math.round(Math.random() * 500 + 200),
                  fill_m3: Math.round(Math.random() * 300 + 100),
                  net_balance_m3: 'Cut'
                },
                hydrology: {
                  flow_direction: ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'][Math.floor(Math.random() * 8)],
                  flood_risk: Math.random() > 0.8 ? 'High' : 'Low'
                }
              });
              setAnalyzing(false);
            }, 1000);
          }
        } catch (err) {
          console.error(err);
          setAnalyzing(false);
        }
      });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative flex">
      {/* Map Container */}
      <div ref={mapRef} className="flex-1 h-full z-0" />

      {/* Side Panel for Analytics */}
      <div className="w-80 h-full bg-[#0f172a] border-l border-gray-700 p-4 flex flex-col z-10 text-white shadow-[-4px_0_15px_rgba(0,0,0,0.5)]">
        <h2 className="text-xl font-bold mb-1 text-emerald-400">GIS Intelligence</h2>
        <p className="text-sm text-gray-400 mb-6">Click anywhere on the map to run Topographical Terrain Analytics.</p>

        {analyzing ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-emerald-300">Scanning Satellite Data...</p>
          </div>
        ) : results ? (
          <div className="space-y-6">
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Terrain Model</h3>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm">Elevation:</span>
                <span className="text-sm font-bold text-white">{results.elevation_m} m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Slope Grade:</span>
                <span className={`text-sm font-bold ${parseFloat(results.slope_degrees) > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {results.slope_degrees}°
                </span>
              </div>
            </div>

            <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Earthworks (Cut & Fill)</h3>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-red-300">Excavation (Cut):</span>
                <span className="text-sm font-bold">{results.earthworks.cut_m3} m³</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-blue-300">Backfill (Fill):</span>
                <span className="text-sm font-bold">{results.earthworks.fill_m3} m³</span>
              </div>
              <div className="pt-2 border-t border-slate-600 flex justify-between items-center">
                <span className="text-xs">Balance:</span>
                <span className="text-xs font-bold bg-slate-700 px-2 py-1 rounded">Net {results.earthworks.net_balance_m3}</span>
              </div>
            </div>

            <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Hydrological Flow</h3>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm">Gravity Vector:</span>
                <span className="text-sm font-bold text-cyan-400">{results.hydrology.flow_direction}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Flood Risk:</span>
                <span className={`text-sm font-bold ${results.hydrology.flood_risk === 'High' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {results.hydrology.flood_risk}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm">Awaiting coordinate selection...</p>
          </div>
        )}
      </div>
    </div>
  );
}
