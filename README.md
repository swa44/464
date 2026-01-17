# 📦 재고조사 웹 애플리케이션

실시간으로 여러 명이 함께 재고조사를 할 수 있는 웹 애플리케이션입니다.

## 🚀 주요 기능

- **CSV 업로드**: 제품 목록을 CSV 파일로 한 번에 업로드
- **검색 기능**: 제품명 부분 검색으로 빠른 제품 찾기
- **실시간 동기화**: 여러 사용자가 동시에 수량 입력 가능
- **자동 저장**: 수량 입력 후 자동으로 데이터베이스에 저장
- **CSV 다운로드**: 재고조사 결과를 CSV 파일로 다운로드
- **모바일 최적화**: 핸드폰에서도 편리하게 사용 가능

## 📋 설정 방법

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 로그인
2. "New Project" 클릭하여 새 프로젝트 생성
3. 프로젝트 생성 완료 후 대시보드로 이동

### 2. 데이터베이스 설정

1. Supabase 대시보드에서 "SQL Editor" 클릭
2. `schema.sql` 파일의 내용을 복사하여 실행
3. 테이블 생성 확인

### 3. API 키 설정

1. Supabase 대시보드에서 "Settings" → "API" 클릭
2. 다음 정보를 복사:
   - Project URL
   - anon public key
3. `js/config.js` 파일을 열어 다음 부분 수정:

```javascript
const SUPABASE_URL = "YOUR_SUPABASE_URL"; // 복사한 Project URL
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // 복사한 anon key
```

### 4. 웹 서버 실행

간단한 로컬 서버 실행:

```bash
# Python 3가 설치되어 있다면
python3 -m http.server 8000

# 또는 npx (Node.js가 설치되어 있다면)
npx serve
```

브라우저에서 `http://localhost:8000` (또는 해당 포트)로 접속

## 📱 사용 방법

### 1단계: CSV 업로드

1. `index.html` 페이지로 이동
2. 제품 목록 CSV 파일 준비 (형식: 제품번호, 제품명, 수량)
3. 파일을 드래그하거나 클릭하여 선택
4. "데이터베이스에 업로드" 버튼 클릭

### 2단계: 재고조사

1. `inventory.html` 페이지로 이동
2. 검색창에 제품명 입력
3. 검색 결과에서 수량 입력
4. 자동으로 저장됨 (500ms 디바운싱)

### 3단계: 데이터 다운로드

1. `download.html` 페이지로 이동
2. 통계 확인 (총 제품 수, 재고 입력 완료, 진행률)
3. 필요시 "수량이 입력된 제품만 다운로드" 체크
4. "CSV 다운로드" 버튼 클릭

## 📂 파일 구조

```
464/root/
├── index.html          # CSV 업로드 페이지
├── inventory.html      # 재고조사 페이지
├── download.html       # CSV 다운로드 페이지
├── css/
│   └── style.css       # 전역 스타일
├── js/
│   ├── config.js       # Supabase 설정
│   ├── upload.js       # CSV 업로드 로직
│   ├── inventory.js    # 재고조사 로직
│   └── download.js     # CSV 다운로드 로직
├── schema.sql          # 데이터베이스 스키마
├── sample.csv          # 샘플 CSV 파일
└── README.md           # 이 문서
```

## 🗄️ 데이터베이스 스키마

```sql
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,     -- 제품번호
  name TEXT NOT NULL,             -- 제품명
  quantity INTEGER DEFAULT 0,     -- 수량
  created_at TIMESTAMPTZ,         -- 생성 시간
  updated_at TIMESTAMPTZ          -- 수정 시간
);
```

## 🎨 주요 기술

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL)
- **라이브러리**:
  - [Supabase JS](https://github.com/supabase/supabase-js) - 데이터베이스 연동
  - [PapaParse](https://www.papaparse.com/) - CSV 파싱

## 💡 사용 팁

- **검색 최적화**: 제품명 일부만 입력해도 검색 가능
- **키보드 단축키**: 수량 입력 후 Enter 키로 즉시 저장
- **모바일 사용**: 핸드폰 브라우저에서도 정상 작동
- **실시간 협업**: 여러 명이 동시에 다른 제품 수량 입력 가능

## 🔒 보안 참고사항

현재 설정은 간단한 사용을 위해 Row Level Security가 비활성화되어 있습니다.
프로덕션 환경에서는 다음을 고려하세요:

- RLS 활성화
- 사용자 인증 추가
- API 키 보호 (환경 변수 사용)

## 📝 CSV 파일 형식 예시

```csv
제품번호,제품명,수량
P001,삼성 노트북,0
P002,LG 모니터,0
P003,애플 키보드,0
```

첫 번째 행(헤더)은 자동으로 인식되며, 열 이름이 달라도 순서대로 처리됩니다.

## 🐛 문제 해결

### Q: "업로드 중 오류가 발생했습니다"

A: `js/config.js`에 Supabase URL과 API 키가 올바르게 설정되었는지 확인하세요.

### Q: 검색이 안 됩니다

A: CSV 업로드가 완료되었는지 확인하고, Supabase 대시보드에서 데이터를 확인하세요.

### Q: 여러 명이 동시에 작업하려면?

A: 웹 서버를 인터넷에 공개하거나, Netlify/Vercel 같은 호스팅 서비스를 사용하세요.

## 📞 문의

문제가 발생하면 Supabase 대시보드 → Logs에서 에러를 확인하세요.
