import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type PinMapProps = {
  lat: number;
  lng: number;
  onChange: (coords: { lat: number; lng: number }) => void;
};

export function PinMap({ lat, lng, onChange }: PinMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:var(--primary);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChangeRef.current({ lat: pos.lat, lng: pos.lng });
      });
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const current = marker.getLatLng();
    if (Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);

  return <div ref={containerRef} className="h-44 w-full overflow-hidden rounded-xl" />;
}
