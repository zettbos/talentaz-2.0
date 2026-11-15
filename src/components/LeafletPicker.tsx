"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LeafletPickerProps {
  lat: number;
  lng: number;
  radiusMeters: number;
  interactive?: boolean;
  heightClass?: string;
  userLat?: number | null;
  userLng?: number | null;
  onChangeLocation?: (lat: number, lng: number) => void;
}

export default function LeafletPicker({
  lat,
  lng,
  radiusMeters,
  interactive = true,
  heightClass = "h-[320px]",
  userLat = null,
  userLng = null,
  onChangeLocation,
}: LeafletPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChangeLocation);
  const initialViewRef = useRef({ lat, lng, radiusMeters });

  useEffect(() => {
    onChangeRef.current = onChangeLocation;
  }, [onChangeLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const init = initialViewRef.current;

    const map = L.map(containerRef.current, {
      center: [init.lat, init.lng],
      zoom: 16,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const officeIcon = L.divIcon({
      className: "talentaz-office-pin",
      html: `<div style="width:28px;height:28px;border-radius:9999px;background:#1F211E;border:3px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:9999px;background:#347F2F;"></div></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([init.lat, init.lng], {
      draggable: interactive,
      icon: officeIcon,
    }).addTo(map);

    const circle = L.circle([init.lat, init.lng], {
      radius: init.radiusMeters,
      color: "#246326",
      fillColor: "#347F2F",
      fillOpacity: 0.16,
      weight: 2,
    }).addTo(map);

    if (interactive) {
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
        onChangeRef.current?.(
          Number(pos.lat.toFixed(6)),
          Number(pos.lng.toFixed(6))
        );
      });

      map.on("click", (event: L.LeafletMouseEvent) => {
        const pos = event.latlng;
        marker.setLatLng(pos);
        circle.setLatLng(pos);
        onChangeRef.current?.(
          Number(pos.lat.toFixed(6)),
          Number(pos.lng.toFixed(6))
        );
      });
    }

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Ensure Leaflet recalculates dimensions once container paints.
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      userMarkerRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;

    marker.setLatLng([lat, lng]);
    circle.setLatLng([lat, lng]);
    circle.setRadius(radiusMeters);
    map.panTo([lat, lng], { animate: true });
  }, [lat, lng, radiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLat !== null && userLng !== null) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.circleMarker([userLat, userLng], {
          radius: 8,
          color: "#FFFFFF",
          weight: 2,
          fillColor: "#246326",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([userLat, userLng]);
      }
      userMarkerRef.current.bindTooltip("Lokasi Anda", { direction: "top" });
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLat, userLng]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} rounded-xl border border-[#7A8F7C] overflow-hidden z-10 relative`}
      aria-label="Peta lokasi kantor"
    />
  );
}
