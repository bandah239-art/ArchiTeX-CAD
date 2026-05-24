import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons with Vite bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface GeoMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  onLocationChange: (lat: number, lon: number) => void;
}

export function GeoMap({ latitude, longitude, zoom = 14, onLocationChange }: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onLocationChange);

  onChangeRef.current = onLocationChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChangeRef.current(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const current = marker.getLatLng();
    if (Math.abs(current.lat - latitude) < 1e-6 && Math.abs(current.lng - longitude) < 1e-6) return;

    marker.setLatLng([latitude, longitude]);
    map.panTo([latitude, longitude], { animate: true });
  }, [latitude, longitude]);

  return (
    <div className="rounded-lg overflow-hidden border border-infra-accent/30">
      <div ref={containerRef} className="h-56 w-full z-0" />
      <div className="text-[9px] text-gray-500 px-2 py-1 bg-infra-darker flex justify-between">
        <span>Click map or drag pin to set site</span>
        <span>
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
