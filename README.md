# SMBIZ 디지털 콘텐츠 제작실 관리 시스템

서울시 소상공인 허브 디지털 콘텐츠 제작실의 장비 예약 및 통계 관리 대시보드

## 🎨 디자인 레퍼런스

- **전반적 기조**: Raycast + Appsmith
- **메인 페이지**: Raycast (커맨드 중심, 깔끔한 인터랙션)
- **통계 페이지**: Mixpanel (전문적인 데이터 시각화)
- **관리자 페이지**: Directus + Appsmith (모던 어드민 패널)

## 🚀 시작하기

### 1. Node.js 설치
Node.js 18+ 버전 필요

### 2. 패키지 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.example` 파일을 복사해서 `.env` 생성

```bash
cp .env.example .env
```

`.env` 파일에 Supabase 정보 입력:
```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 4. Supabase 데이터베이스 설정
`database-schema.sql` 파일을 Supabase SQL Editor에서 실행

### 5. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 📁 프로젝트 구조

```
smbiz-dashboard/
├── src/
│   ├── components/          # 재사용 가능한 컴포넌트
│   │   ├── Layout.jsx       # 레이아웃 (사이드바 + 메인)
│   │   ├── Calendar.jsx     # 달력 컴포넌트
│   │   ├── TimelineView.jsx # 타임라인 뷰
│   │   ├── Modal.jsx        # 모달 컴포넌트
│   │   ├── Toast.jsx        # 토스트 알림
│   │   ├── ReservationForm.jsx  # 예약 폼
│   │   └── CompanyForm.jsx  # 기업 폼
│   ├── pages/               # 페이지 컴포넌트
│   │   ├── MainPage.jsx     # 예약 현황 (메인)
│   │   ├── StatsPage.jsx    # 통계 대시보드
│   │   └── AdminPage.jsx    # 관리자 페이지
│   ├── lib/                 # 라이브러리
│   │   └── supabase.js      # Supabase 클라이언트 + API
│   ├── styles/              # 스타일
│   │   └── index.css        # Tailwind + 커스텀 스타일
│   ├── App.jsx              # 앱 라우터
│   └── main.jsx             # 엔트리 포인트
├── chrome-extension/        # SMBIZ 데이터 추출 확장 프로그램
│   ├── manifest.json        # 확장 프로그램 설정
│   ├── content.js           # 페이지 데이터 추출 스크립트
│   ├── popup.html/js        # 팝업 UI
│   └── icons/               # 아이콘
├── database-schema.sql      # 데이터베이스 스키마
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🎯 주요 기능

### 📅 메인 페이지 - 예약 현황
- **날짜 선택 달력**: 원하는 날짜의 예약 현황 확인
- **타임라인 뷰**: 오전/오후 타임으로 나뉜 장비별 예약 현황
- **실시간 시각**: 현재 시각 표시
- **장비별 분류**: 7가지 장비 타입별 예약 상태

**장비 종류**:
- AS360 (Purple)
- MICRO (Blue)
- XL (Green)
- XXL (Amber)
- 알파데스크 (Pink)
- 알파테이블 (Cyan)
- Compact (Indigo)

**시간대**:
- 오전: 09:00 - 13:00 (4시간)
- 오후: 14:00 - 18:00 (4시간)
- 브레이크타임: 13:00 - 14:00 (1시간)

### 📊 상세 페이지 - 통계
- 월별/기간별 가동률 분석
- 자치구별 이용 통계
- 업종별 사용 패턴
- 장비별 가동률 추이

### ⚙️ 관리자 페이지
- **기업 관리**: CRUD 기능
- **예약 관리**: 예약 생성/수정/취소/노쇼 처리
- **장비 관리**: 장비 상태 관리
- **데이터 필터링**: 고급 검색 및 필터
- **CSV 내보내기**: 데이터 다운로드

### 🔌 Chrome Extension
SMBIZ 관리자 페이지(smbiz.sba.kr)에서 예약 데이터를 추출하여 Dashboard에 자동 입력

**설치 방법**:
1. Chrome에서 `chrome://extensions` 접속
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `chrome-extension` 폴더 선택

**사용 방법**:
1. smbiz.sba.kr 예약 상세 페이지에서 "SMBIZ Dashboard로 복사" 버튼 클릭
2. Dashboard 예약 추가 폼에서 "SMBIZ 붙여넣기" 버튼 클릭
3. 기업 정보 자동 매칭 및 폼 자동 입력

## 🎨 디자인 시스템

### 컬러 팔레트
```css
Primary: #FF6363 (Raycast Red)
Background: #0D0D0D, #1A1A1A, #242424
Text: #FFFFFF, #A8A8A8, #6B6B6B
Success: #00D9A5
Warning: #FFB84D
Danger: #FF6B6B
```

### 타이포그래피
- Font: Inter (Google Fonts)
- 사이즈: 12px ~ 36px (Tailwind scale)

## 📦 기술 스택

- **Frontend**: React 18
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Router**: React Router v6
- **Database**: Supabase (PostgreSQL)
- **Date Utils**: date-fns
- **Charts**: Recharts
- **State**: Zustand
- **Animations**: Framer Motion

## 📊 데이터베이스 스키마

### 주요 테이블
1. **companies**: 기업 정보
2. **equipment**: 장비 정보
3. **reservations**: 예약 정보
4. **reservation_equipment**: 예약-장비 매핑 (N:N)

### 뷰 (Views)
1. **equipment_utilization**: 장비 가동률 통계
2. **district_statistics**: 자치구별 통계
3. **industry_statistics**: 업종별 통계
4. **daily_reservations**: 일별 예약 현황

## 🔒 보안

- Row Level Security (RLS) 활성화
- 인증된 사용자만 데이터 접근 가능
- API 키는 환경 변수로 관리

## 📱 반응형

- 데스크탑 최적화 (1920px 기준)
- 태블릿 대응 (768px+)

## ✅ 완료된 기능

- [x] 예약 생성/수정/삭제 모달
- [x] 기업 CRUD (생성/수정/삭제)
- [x] 장비 관리
- [x] 통계 페이지 (차트, 필터, CSV 내보내기)
- [x] 노쇼(No-Show) 처리 기능
- [x] 커스텀 확인 모달 (브라우저 confirm 대체)
- [x] Toast 알림 시스템
- [x] 에러 바운더리
- [x] Chrome Extension (SMBIZ 데이터 추출)
- [x] 클립보드 붙여넣기로 예약 데이터 자동 입력

## 🚧 개발 중인 기능

- [ ] 드래그 앤 드롭 예약 변경
- [ ] 실시간 알림
- [ ] PDF 리포트 생성

## 📝 라이센스

MIT License

## 👤 Contact

문의사항이 있으시면 연락주세요.
