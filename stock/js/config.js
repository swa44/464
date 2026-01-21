// Supabase 설정
const SUPABASE_URL = "https://rgfvubjdjyuitprsagkx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZnZ1Ympkanl1aXRwcnNhZ2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NDEzODEsImV4cCI6MjA4NDIxNzM4MX0.yNmb9v4ncLlOaMZ52-yu9EJ3CLV0yI_AGE_m0fX3SOk";

// Supabase 클라이언트 초기화
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// 테이블 이름
const PRODUCTS_TABLE = "products";

// ECOUNT ERP 설정
const ECOUNT_CONFIG = {
  ZONE: "AB",
  SESSION_ID:
    "3630333437367c256561256230253935256563253838253938256564253939253934:AB-ET6v8Uq6DPa!a",
  WH_CD: "7777", // 조회할 창고 코드 (폴라베어창고)
  API_URL_TEMPLATE:
    "https://sboapi{ZONE}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID={SESSION_ID}",
};
