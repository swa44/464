"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { amapUrl, distanceM, wgsToGcj } from "./amap";
import { restaurants, type Restaurant } from "./data";

type Filter = "전체" | Restaurant["group"];
type LatLng = [number, number];
type Located = Restaurant & { pos: LatLng; no: number };

const COLORS: Record<Restaurant["group"], string> = {
  해산물: "#0f6e78",
  전통음식: "#c2562c",
  "팔시 간식": "#b07d12",
  구랑위: "#6a4fb3",
  미쉐린: "#b3263a",
};
const FILTERS: Filter[] = ["전체", ...(Object.keys(COLORS) as Restaurant["group"][])];

// 스위스 그랜드 샤먼 (WGS-84)
const HOTEL: LatLng = [24.4525, 118.0741];

// 지도 번호는 데이터 순서로 고정해서 필터·정렬이 바뀌어도 같은 식당은 같은 번호를 유지한다.
const located: Located[] = restaurants
  .filter((r): r is Restaurant & { pos: LatLng } => Boolean(r.pos))
  .map((r, i) => ({ ...r, no: i + 1 }));
const unlocated = restaurants.filter((r) => !r.pos);

function formatDistance(m: number) {
  const dist = m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
  // 직선거리 × 1.3 ≈ 실제 걷는 거리, 분당 75m
  const walk = Math.round((m * 1.3) / 75);
  return m > 2500 ? `직선 ${dist} · 택시 추천` : `직선 ${dist} · 걸어서 약 ${Math.max(1, walk)}분`;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function popupHtml(r: Located, from: LatLng, fromLabel: string) {
  const keyword = r.zh ?? r.addr;
  return `
    <div class="pop-card">
      <b>${r.no}. ${escapeHtml(r.name)}</b>
      ${r.zh ? `<div class="pop-zh">${escapeHtml(r.zh)}</div>` : ""}
      <div class="pop-menu">${escapeHtml(r.menu)}</div>
      <div class="pop-dist">${fromLabel} ${formatDistance(distanceM(from, r.pos))}</div>
      ${r.approx ? `<div class="pop-approx">도로 기준 대략 위치예요. 정확한 위치는 고덕에서 확인하세요.</div>` : ""}
      ${keyword ? `<a class="btn wide" href="${amapUrl(keyword)}" target="_blank" rel="noreferrer">고덕에서 열기</a>` : ""}
    </div>`;
}

export default function MapTab() {
  const boxRef = useRef<HTMLDivElement>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const meLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const markersRef = useRef(new Map<number, Leaflet.Marker>());
  const watchRef = useRef<number | null>(null);
  const centeredRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>("전체");
  const [me, setMe] = useState<{ pos: LatLng; acc: number } | null>(null);
  const [status, setStatus] = useState("");

  const from = me?.pos ?? HOTEL;
  const fromLabel = me ? "내 위치에서" : "호텔에서";

  const shown = useMemo(
    () =>
      located
        .filter((r) => filter === "전체" || r.group === filter)
        .map((r) => ({ r, d: distanceM(from, r.pos) }))
        .sort((a, b) => a.d - b.d),
    [filter, from],
  );

  // 지도 만들기 (한 번)
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      if (cancelled || !boxRef.current) return;
      LRef.current = L;
      const map = L.map(boxRef.current, { zoomControl: true, attributionControl: true }).setView(wgsToGcj(HOTEL), 15);
      // 고덕 타일: 중국 안에서 VPN 없이 빠르게 뜨고 중국어 지명이 나온다.
      L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", {
        subdomains: "1234",
        maxZoom: 18,
        attribution: "© 高德地图",
      }).addTo(map);
      L.marker(wgsToGcj(HOTEL), {
        icon: L.divIcon({ className: "", html: '<span class="pin-hotel">🏨</span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
        zIndexOffset: 1000,
      })
        .bindPopup('<div class="pop-card"><b>스위스 그랜드 샤먼 (숙소)</b><div class="pop-zh">厦门瑞颐大酒店</div></div>')
        .addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      meLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  // 필터가 바뀔 때만 식당 마커를 다시 그린다
  useEffect(() => {
    const L = LRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    for (const r of located) {
      if (filter !== "전체" && r.group !== filter) continue;
      const marker = L.marker(wgsToGcj(r.pos), {
        icon: L.divIcon({
          className: "",
          html: `<span class="pin" style="--c:${COLORS[r.group]}">${r.no}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          popupAnchor: [0, -12],
        }),
      }).bindPopup("", { maxWidth: 260 });
      marker.addTo(layer);
      markersRef.current.set(r.no, marker);
    }
  }, [ready, filter]);

  // 위치가 움직여도 열린 팝업이 닫히지 않게 내용만 바꾼다
  useEffect(() => {
    for (const r of located) markersRef.current.get(r.no)?.setPopupContent(popupHtml(r, from, fromLabel));
  }, [ready, filter, from, fromLabel]);

  // 내 위치 점 + 정확도 원
  useEffect(() => {
    const L = LRef.current;
    const layer = meLayerRef.current;
    const map = mapRef.current;
    if (!ready || !L || !layer || !map) return;
    layer.clearLayers();
    if (!me) return;
    const p = wgsToGcj(me.pos);
    L.circle(p, { radius: me.acc, color: "#2a7de1", weight: 1, fillOpacity: 0.12 }).addTo(layer);
    L.marker(p, {
      icon: L.divIcon({ className: "", html: '<span class="pin-me"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      zIndexOffset: 2000,
    }).addTo(layer);
    if (!centeredRef.current) {
      centeredRef.current = true;
      map.setView(p, 16);
    }
  }, [ready, me]);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setStatus("이 브라우저는 위치 기능을 지원하지 않아요.");
      return;
    }
    if (me && mapRef.current) {
      mapRef.current.setView(wgsToGcj(me.pos), 16);
      return;
    }
    setStatus("위치를 찾는 중…");
    centeredRef.current = false;
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setMe({ pos: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy });
        setStatus("");
      },
      (err) => {
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 꺼져 있어요. 설정 > 사파리(또는 브라우저) > 위치에서 허용해 주세요."
            : "위치를 찾지 못했어요. 잠시 후 다시 눌러 주세요.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };

  const focus = (r: Located) => {
    const map = mapRef.current;
    const marker = markersRef.current.get(r.no);
    if (!map || !marker) return;
    boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16));
    marker.openPopup();
  };

  const showAll = () => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || shown.length === 0) return;
    const pts = shown.map(({ r }) => wgsToGcj(r.pos));
    if (me) pts.push(wgsToGcj(me.pos));
    map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
  };

  return (
    <section className="list">
      <p className="hint">
        숫자 핀을 누르면 메뉴와 거리가 나와요. <b>내 위치</b>를 켜면 아래 목록이 가까운 순으로 정렬돼요. (켜기 전엔 호텔 기준)
      </p>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} type="button" className={f === filter ? "chip active" : "chip"} onClick={() => setFilter(f)}>
            {f !== "전체" && <span className="dot" style={{ background: COLORS[f] }} />}
            {f}
          </button>
        ))}
      </div>

      <div className="map-wrap">
        <div ref={boxRef} className="map" />
        <div className="map-actions">
          <button type="button" className="btn" onClick={locate}>📍 내 위치</button>
          <button type="button" className="btn ghost" onClick={showAll}>전체 보기</button>
        </div>
      </div>
      {status && <p className="hint">{status}</p>}

      <div className="card near">
        <h2>{me ? "내 위치에서 가까운 순" : "호텔에서 가까운 순"}</h2>
        <ol className="near-list">
          {shown.map(({ r, d }) => (
            <li key={r.no}>
              <button type="button" onClick={() => focus(r)}>
                <span className="pin" style={{ ["--c" as string]: COLORS[r.group] }}>{r.no}</span>
                <span className="near-text">
                  <b>{r.name}</b>
                  <span className="muted">
                    {formatDistance(d)}
                    {r.approx && " · 대략"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {unlocated.some((r) => filter === "전체" || r.group === filter) && (
        <div className="card">
          <h2>지도에 없는 곳</h2>
          <p className="muted">지점을 특정하지 못해 지도에서 뺐어요. 고덕에서 검색해 보세요.</p>
          <ul className="tips">
            {unlocated
              .filter((r) => filter === "전체" || r.group === filter)
              .map((r) => (
                <li key={r.name}>
                  {r.zh ? (
                    <a href={amapUrl(r.zh)} target="_blank" rel="noreferrer">{r.name} · {r.zh}</a>
                  ) : (
                    r.name
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
