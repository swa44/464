-- 재고조사 앱 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요

-- products 테이블 생성
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 제품명 부분 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- 제품번호 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

-- Row Level Security 비활성화 (간단한 앱이므로 인증 없이 사용)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 업데이트 시간 자동 갱신 트리거
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
