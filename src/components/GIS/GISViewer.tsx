import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGeoStore } from '../../store/geoStore';
import { useCalculationStore } from '../../store/calculationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

export function GISViewer() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const importedGeoJson = useGeoStore((s) => s.importedGeoJson);

  useEffect(() => {
    if (!mapInstance.current) return;

    if (geoJsonLayerRef.current) {
      mapInstance.current.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    if (importedGeoJson) {
      try {
        const layer = L.geoJSON(importedGeoJson, {
          style: {
            color: '#10b981',
            weight: 3,
            opacity: 0.8,
            fillColor: '#10b981',
            fillOpacity: 0.2
          }
        }).addTo(mapInstance.current);
        geoJsonLayerRef.current = layer;

        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          mapInstance.current.fitBounds(bounds);
        }
      } catch (err) {
        console.error('Failed to render imported GeoJSON:', err);
      }
    }
  }, [importedGeoJson]);

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
            // Backend unavailable — try OpenElevation for real elevation data
            try {
              const elevRes = await fetch(
                `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`
              ).catch(() => null);
              const elevData = elevRes?.ok ? await elevRes.json() : null;
              const elevation = elevData?.results?.[0]?.elevation ?? null;
              setResults({
                elevation_m: elevation,
                slope_degrees: null,
                earthworks: null,
                hydrology: null,
                _partial: true,
              });
            } catch {
              setResults({ _unavailable: true });
            }
            setAnalyzing(false);
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
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-emerald-300">Fetching terrain data…</p>
          </div>

        ) : results?._unavailable ? (
          <div className="p-3 bg-slate-800 rounded-lg border border-slate-600 text-center text-xs text-gray-500">
            Backend offline — terrain analytics unavailable.<br />
            Start the Python server to enable full site analysis.
          </div>

        ) : results?._partial ? (
          <div className="space-y-3">
            {results.elevation_m !== null ? (
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Elevation (OpenElevation)</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Elevation:</span>
                  <span className="text-sm font-bold text-white">{results.elevation_m} m ASL</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Elevation data unavailable.</p>
            )}
            <div className="p-3 bg-amber-900/20 border border-amber-700/40 rounded text-xs text-amber-300">
              Slope, earthworks and hydrology require the backend server.
              Start Python server for full analysis.
            </div>

            {/* Push to geo calcs */}
            {results.elevation_m && (
              <button
                type="button"
                onClick={() => {
                  useWorkspaceStore.getState().openPanel('calculator');
                  useCalculationStore.getState().setModule('geo');
                  useCalculationStore.getState().setInputs({ site_elevation_m: results.elevation_m });
                }}
                className="w-full py-2 text-xs bg-emerald-800/40 hover:bg-emerald-800/60 text-emerald-300 rounded border border-emerald-700/40 transition-colors"
              >
                Push elevation → Site Geotechnics calculator →
              </button>
            )}
          </div>

        ) : results ? (
          <div className="space-y-3">
            {/* Terrain */}
            <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Terrain</h3>
              {results.elevation_m != null && (
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Elevation</span>
                  <span className="text-sm font-bold text-white">{results.elevation_m} m</span>
                </div>
              )}
              {results.slope_degrees != null && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">Slope</span>
                  <span className={`text-sm font-bold ${parseFloat(results.slope_degrees) > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {results.slope_degrees}°
                  </span>
                </div>
              )}
            </div>

            {/* Earthworks */}
            {results.earthworks && (
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Earthworks</h3>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-red-300">Cut</span>
                  <span className="font-bold">{results.earthworks.cut_m3} m³</span>
                </div>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-blue-300">Fill</span>
                  <span className="font-bold">{results.earthworks.fill_m3} m³</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-600">
                  <span>Balance</span>
                  <span className="font-bold">Net {results.earthworks.net_balance_m3}</span>
                </div>
              </div>
            )}

            {/* Hydrology */}
            {results.hydrology && (
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-600">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Hydrology</h3>
                <div className="flex justify-between mb-1 text-sm">
                  <span>Flow direction</span>
                  <span className="font-bold text-cyan-400">{results.hydrology.flow_direction}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Flood risk</span>
                  <span className={`font-bold ${results.hydrology.flood_risk === 'High' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {results.hydrology.flood_risk}
                  </span>
                </div>
              </div>
            )}

            {/* Push to calculators */}
            <div className="space-y-1 pt-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Push to Calculator</p>
              {results.elevation_m != null && (
                <button type="button"
                  onClick={() => { useWorkspaceStore.getState().openPanel('calculator'); useCalculationStore.getState().setModule('geo'); useCalculationStore.getState().setInputs({ site_elevation_m: results.elevation_m }); }}
                  className="w-full py-1.5 text-xs bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 rounded border border-emerald-700/30 transition-colors text-left px-2">
                  🌍 Site elevation → Geotechnics
                </button>
              )}
              {results.hydrology?.flood_risk === 'High' && (
                <button type="button"
                  onClick={() => { useWorkspaceStore.getState().openPanel('calculator'); useCalculationStore.getState().setModule('wash_stormwater'); }}
                  className="w-full py-1.5 text-xs bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 rounded border border-blue-700/30 transition-colors text-left px-2">
                  💧 Flood risk → Stormwater Design
                </button>
              )}
              {results.slope_degrees != null && parseFloat(results.slope_degrees) > 8 && (
                <button type="button"
                  onClick={() => { useWorkspaceStore.getState().openPanel('calculator'); useCalculationStore.getState().setModule('geo_slope'); useCalculationStore.getState().setInputs({ slope_angle_deg: parseFloat(results.slope_degrees) }); }}
                  className="w-full py-1.5 text-xs bg-amber-900/40 hover:bg-amber-900/60 text-amber-300 rounded border border-amber-700/30 transition-colors text-left px-2">
                  ⛰ Steep slope → Slope Stability
                </button>
              )}
              {results.earthworks && (
                <button type="button"
                  onClick={() => { useWorkspaceStore.getState().openPanel('calculator'); useCalculationStore.getState().setModule('road'); useCalculationStore.getState().setInputs({ earthworks_cut_m3: results.earthworks.cut_m3, earthworks_fill_m3: results.earthworks.fill_m3 }); }}
                  className="w-full py-1.5 text-xs bg-orange-900/40 hover:bg-orange-900/60 text-orange-300 rounded border border-orange-700/30 transition-colors text-left px-2">
                  🛣 Earthworks → Road/Pavement Design
                </button>
              )}
            </div>
          </div>

        ) : (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm">Click anywhere on the map to analyse terrain.</p>
          </div>
        )}
      </div>
    </div>
  );
}
