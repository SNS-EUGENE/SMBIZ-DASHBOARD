# 📂 프로젝트 구조

## 전체 파일 구조

```
smbiz-dashboard/
│
├── src/                          # 소스 코드
│   ├── components/               # 재사용 컴포넌트
│   │   ├── Layout.jsx           # 레이아웃 (사이드바 + 라우터)
│   │   ├── Calendar.jsx         # 달력 컴포넌트
│   │   └── TimelineView.jsx    # 타임라인 뷰 컴포넌트
│   │
│   ├── pages/                   # 페이지 컴포넌트
│   │   ├── MainPage.jsx         # 예약 현황 메인 페이지
│   │   ├── StatsPage.jsx        # 통계 대시보드 페이지
│   │   └── AdminPage.jsx        # 관리자 데이터 관리 페이지
│   │
│   ├── lib/                     # 라이브러리 및 유틸리티
│   │   └── supabase.js          # Supabase 클라이언트 + API 헬퍼
│   │
│   ├── styles/                  # 스타일 파일
│   │   └── index.css            # Tailwind + 커스텀 CSS
│   │
│   ├── App.jsx                  # 앱 라우터
│   └── main.jsx                 # 엔트리 포인트
│
├── database-schema.sql          # Supabase DB 스키마
├── package.json                 # NPM 의존성 및 스크립트
├── vite.config.js              # Vite 설정
├── tailwind.config.js          # Tailwind CSS 설정
├── postcss.config.js           # PostCSS 설정
├── index.html                  # HTML 템플릿
├── .env.example                # 환경 변수 예제
├── .gitignore                  # Git 제외 파일
├── README.md                   # 프로젝트 설명
├── SETUP.md                    # 설치 가이드
└── PROJECT_STRUCTURE.md        # 이 파일
```

---

## 📝 주요 파일 설명

### 🎨 Components

#### `Layout.jsx`
- **역할**: 전체 레이아웃 구조
- **포함 요소**:
  - 사이드바 네비게이션
  - 로고 및 현재 시각 표시
  - React Router Outlet
- **디자인**: Raycast 스타일 사이드바

#### `Calendar.jsx`
- **역할**: 날짜 선택 달력
- **기능**:
  - 월별 달력 표시
  - 오늘 날짜 하이라이트
  - 선택된 날짜 강조
  - 이전/다음 달 네비게이션
- **Props**:
  - `selectedDate`: 선택된 날짜
  - `onDateSelect`: 날짜 선택 콜백

#### `TimelineView.jsx`
- **역할**: 장비별 예약 타임라인
- **기능**:
  - 오전/오후 시간대 구분
  - 7가지 장비별 예약 카드 표시
  - 예약 상태 배지
  - 빈 슬롯 표시
- **Props**:
  - `date`: 표시할 날짜
  - `reservations`: 예약 목록
  - `equipmentTypes`: 장비 타입 배열
  - `loading`: 로딩 상태
  - `onRefresh`: 새로고침 콜백

---

### 📄 Pages

#### `MainPage.jsx` - 예약 현황
- **URL**: `/main`
- **기능**:
  - 날짜별 예약 현황 조회
  - 달력 인터페이스
  - 타임라인 뷰
  - 오늘의 통계 카드
- **API 호출**:
  - `api.reservations.getByDate()`

#### `StatsPage.jsx` - 통계 대시보드
- **URL**: `/stats`
- **기능**:
  - 월별 가동률 차트
  - 장비별 이용 통계
  - 자치구별 분포
  - 업종별 사용 패턴
- **차트 라이브러리**: Recharts
- **API 호출**:
  - `api.stats.getEquipmentUtilization()`
  - `api.stats.getDistrictStats()`
  - `api.stats.getIndustryStats()`

#### `AdminPage.jsx` - 관리자 페이지
- **URL**: `/admin`
- **탭 구조**:
  1. 기업 관리
  2. 예약 관리
  3. 장비 관리
- **기능**:
  - 데이터 테이블 뷰
  - 검색 및 필터
  - CRUD 버튼 (수정/삭제)
- **API 호출**:
  - `api.companies.getAll()`
  - `api.reservations.getAll()`
  - `api.equipment.getAll()`

---

### 🔧 Lib

#### `supabase.js`
Supabase 클라이언트 및 API 헬퍼 함수

**주요 Export**:
```javascript
export const supabase        // Supabase 클라이언트
export const api = {
  companies: { ... },        // 기업 CRUD
  equipment: { ... },        // 장비 CRUD
  reservations: { ... },     // 예약 CRUD
  stats: { ... }            // 통계 조회
}
```

**API 메서드 예시**:
- `api.companies.getAll()` - 전체 기업 목록
- `api.companies.getById(id)` - 기업 상세
- `api.companies.create(data)` - 기업 생성
- `api.companies.update(id, data)` - 기업 수정
- `api.companies.delete(id)` - 기업 삭제

---

### 🎨 Styles

#### `index.css`
Tailwind CSS + 커스텀 스타일

**주요 클래스**:
```css
/* 컴포넌트 */
.card                 /* 카드 컨테이너 */
.btn                  /* 버튼 기본 */
.btn-primary          /* 주요 버튼 */
.btn-secondary        /* 보조 버튼 */
.btn-ghost            /* 고스트 버튼 */
.input                /* 입력 필드 */
.badge                /* 배지 */
.badge-success        /* 성공 배지 */
.badge-warning        /* 경고 배지 */
.badge-danger         /* 위험 배지 */
.table                /* 테이블 */
.skeleton             /* 스켈레톤 로딩 */
```

---

## 🗄️ Database Schema

### 테이블

#### `companies` - 기업 정보
```sql
- id (UUID, PK)
- name (VARCHAR)
- representative (VARCHAR)
- business_number (VARCHAR, UNIQUE)
- company_size (VARCHAR)
- industry (VARCHAR)
- contact (VARCHAR)
- email (VARCHAR)
- address (TEXT)
- district (VARCHAR)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `equipment` - 장비 정보
```sql
- id (UUID, PK)
- name (VARCHAR, UNIQUE)
- type (VARCHAR)
- description (TEXT)
- status (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `reservations` - 예약 정보
```sql
- id (UUID, PK)
- company_id (UUID, FK)
- reservation_date (DATE)
- time_slot (VARCHAR)
- status (VARCHAR)
- work_2d (INTEGER)
- work_3d (INTEGER)
- work_video (INTEGER)
- work_advanced (INTEGER)
- attendees (INTEGER)
- is_training (BOOLEAN)
- is_seminar (BOOLEAN)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `reservation_equipment` - 예약-장비 매핑
```sql
- id (UUID, PK)
- reservation_id (UUID, FK)
- equipment_id (UUID, FK)
- usage_hours (DECIMAL)
- created_at (TIMESTAMP)
```

### 뷰 (Views)

#### `equipment_utilization` - 장비 가동률
월별 장비 가동률 통계

#### `district_statistics` - 자치구별 통계
자치구별 이용 현황

#### `industry_statistics` - 업종별 통계
업종별 사용 패턴

#### `daily_reservations` - 일별 예약 현황
메인 페이지용 예약 뷰

---

## 🎨 디자인 시스템

### 컬러 팔레트 (Raycast 기반)
```javascript
Primary:     #FF6363 (Red)
Success:     #00D9A5 (Green)
Warning:     #FFB84D (Amber)
Danger:      #FF6B6B (Red)

Background:
  - primary:   #0D0D0D (거의 블랙)
  - secondary: #1A1A1A
  - tertiary:  #242424
  - elevated:  #2D2D2D

Text:
  - primary:   #FFFFFF
  - secondary: #A8A8A8
  - tertiary:  #6B6B6B
  - muted:     #4A4A4A

Border:      #2D2D2D
```

### 장비 컬러
```javascript
AS360:      #8B5CF6 (Purple)
MICRO:      #3B82F6 (Blue)
XL:         #10B981 (Green)
XXL:        #F59E0B (Amber)
알파데스크:  #EC4899 (Pink)
알파테이블:  #06B6D4 (Cyan)
Compact:    #6366F1 (Indigo)
```

### 타이포그래피
- **Font Family**: Inter (Google Fonts)
- **Sizes**: 12px - 36px (Tailwind scale)
- **Weights**: 300, 400, 500, 600, 700

---

## 🔄 데이터 흐름

### 메인 페이지
```
User → Select Date → MainPage.jsx
                      ↓
                   fetchReservations()
                      ↓
                api.reservations.getByDate()
                      ↓
                   Supabase
                      ↓
                TimelineView.jsx
                      ↓
                Display Reservations
```

### 통계 페이지
```
User → Select Month → StatsPage.jsx
                       ↓
                   fetchStats()
                       ↓
        api.stats.getEquipmentUtilization()
        api.stats.getDistrictStats()
        api.stats.getIndustryStats()
                       ↓
                   Supabase Views
                       ↓
                  Recharts Display
```

### 관리자 페이지
```
User → Select Tab → AdminPage.jsx
                     ↓
                 fetchData()
                     ↓
          api.companies.getAll()
          api.reservations.getAll()
          api.equipment.getAll()
                     ↓
                 Supabase
                     ↓
              Table Display
```

---

## 🚀 빌드 프로세스

1. **개발 모드**: `npm run dev`
   - Vite dev server 시작
   - Hot Module Replacement (HMR)
   - Port: 3000

2. **프로덕션 빌드**: `npm run build`
   - Vite 최적화 빌드
   - 출력: `dist/` 폴더
   - 트리쉐이킹 + 코드 스플리팅

3. **미리보기**: `npm run preview`
   - 빌드 결과 미리보기
   - Port: 4173

---

## 📦 주요 의존성

### 프로덕션
- `react` - UI 라이브러리
- `react-dom` - React DOM 렌더러
- `react-router-dom` - 라우팅
- `@supabase/supabase-js` - Supabase 클라이언트
- `date-fns` - 날짜 유틸리티
- `recharts` - 차트 라이브러리
- `framer-motion` - 애니메이션
- `zustand` - 상태 관리

### 개발
- `vite` - 빌드 툴
- `@vitejs/plugin-react` - React 플러그인
- `tailwindcss` - CSS 프레임워크
- `autoprefixer` - CSS 후처리
- `postcss` - CSS 처리
- `eslint` - 코드 린터

---

## 🔐 환경 변수

`.env` 파일:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUz...
```

**주의**: `.env` 파일은 절대 Git에 커밋하지 마세요!
