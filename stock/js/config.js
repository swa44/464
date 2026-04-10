// Supabase 설정
const SUPABASE_URL = "https://zkogemvwkrjhttjvachs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb2dlbXZ3a3JqaHR0anZhY2hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjQ5MTcsImV4cCI6MjA5MTI0MDkxN30.jvhfLGDxpYyuOnXXRxQLU6rauzSOcWxcgBZdbvjdUZk";

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
  WH_CD: "7777", // 조회할 창고 코드 (폴라베어창고)
};
