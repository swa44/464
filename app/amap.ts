// 고덕지도(高德地图) 관련 도우미.

// 350200 = 샤먼 행정코드. callnative=1이면 고덕 앱이 설치돼 있을 때 앱으로 연다.
export function amapUrl(keyword: string) {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&city=350200&callnative=1`;
}

// 중국 지도 타일(고덕)은 GCJ-02 좌표계라 GPS·OSM 좌표(WGS-84)를 그대로 찍으면 수백 m 어긋난다.
// 화면에 찍을 때만 변환하고, 거리 계산은 WGS-84끼리 한다.
const A = 6378245.0;
const EE = 0.00669342162296594323;

function tLat(x: number, y: number) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  r += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  r += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3;
  return r;
}

function tLng(x: number, y: number) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  r += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  r += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3;
  return r;
}

export function wgsToGcj([lat, lng]: [number, number]): [number, number] {
  const dLat0 = tLat(lng - 105, lat - 35);
  const dLng0 = tLng(lng - 105, lat - 35);
  const rad = (lat / 180) * Math.PI;
  const magic = 1 - EE * Math.sin(rad) ** 2;
  const sq = Math.sqrt(magic);
  const dLat = (dLat0 * 180) / (((A * (1 - EE)) / (magic * sq)) * Math.PI);
  const dLng = (dLng0 * 180) / ((A / sq) * Math.cos(rad) * Math.PI);
  return [lat + dLat, lng + dLng];
}

// 두 WGS-84 좌표 사이 직선거리(m)
export function distanceM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
