# SMBIZ Dashboard

성수 디지털콘텐츠제작실(3F) 장비 예약 관리 대시보드

## 기술 스택

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS (macOS-inspired dark theme)
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Auth**: Supabase Auth (email + password)
- **Notifications**: KakaoWork Bot API (via Edge Function)
- **Hosting**: Vercel (SPA + Cron)
- **Font**: Pretendard

## 주요 기능

### 예약 현황 (메인)
- 날짜별 타임라인 뷰 (오전/오후, 장비 7종)
- 달력 네비게이션, 실시간 시계

### 예약 관리
- 예약 CRUD, 상태 변경 (신청/확정/완료/취소/노쇼)
- Excel 내보내기 (월별/기간별)

### 통계
- 월별 가동률, 자치구별/업종별/기업규모별 분석
- Recharts 기반 차트 시각화

### 기업 / 장비 관리
- 기업 CRUD, 장비 상태 관리

### 점검 관리
- 시설 일일점검 (캘린더 뷰)
- 장비 주간점검 (주차별 체크리스트)

### 만족도 조사
- 내부 관리 + 외부 공개 설문 페이지 (`/survey`)
- 예약 건별 만족도 평가 (5점 척도)

### 설정
- SMBIZ 예약 동기화 (수동/자동 1시간 Cron)
- KakaoWork 알림 수신자 관리
- 공휴일 관리, 확인자 설정

### 인증
- Supabase Auth 로그인 (이메일 + 비밀번호)
- `/survey` 제외 전 페이지 보호
- 세션 자동 유지 + 새로고침 시 유지

### 알림 (KakaoWork)
- 예약 생성/수정/취소 시 알림
- 만족도조사 완료 시 알림
- 시설/장비 점검 완료 시 알림
- SMBIZ 동기화 신규/상태변경 알림

## 프로젝트 구조

```
src/
├── components/        # UI 컴포넌트
│   ├── Layout.tsx     # 사이드바 + 헤더 + 하단탭
│   ├── AuthProvider.tsx       # 인증 컨텍스트
│   ├── ProtectedRoute.tsx     # 라우트 가드
│   ├── TimelineView.tsx       # 타임라인 뷰
│   ├── ReservationForm.tsx    # 예약 폼
│   ├── ReservationDetailModal.tsx
│   ├── SurveySubmissionForm.tsx
│   ├── FacilityInspectionTab.tsx
│   ├── EquipmentInspectionTab.tsx
│   ├── HolidayManager.tsx
│   ├── Modal.tsx / Toast.tsx / Calendar.tsx
│   └── ...
├── pages/             # 페이지
│   ├── LoginPage.tsx
│   ├── MainPage.tsx           # 예약 현황
│   ├── ReservationsPage.tsx   # 예약 관리
│   ├── StatsPage.tsx          # 통계
│   ├── CompaniesPage.tsx      # 기업 관리
│   ├── EquipmentPage.tsx      # 장비 관리
│   ├── InspectionsPage.tsx    # 점검 관리
│   ├── SurveysPage.tsx        # 만족도 관리
│   ├── SurveyPage.tsx         # 외부 만족도조사 (공개)
│   └── SettingsPage.tsx       # 설정
├── lib/
│   ├── supabase.ts    # Supabase 클라이언트 + API + Auth
│   ├── notifications.ts       # KakaoWork 알림 헬퍼
│   ├── dateUtils.ts / holidays.ts / exportUtils.ts
│   └── utils.ts
├── constants/         # 상수 (장비, 점검 항목 등)
├── types/             # TypeScript 타입 정의
└── App.tsx            # 라우팅

supabase/functions/
├── sync-reservations/ # SMBIZ 예약 동기화 Edge Function
└── send-notification/ # KakaoWork 알림 발송 Edge Function

api/
└── sync-cron.ts       # Vercel Cron → sync-reservations 호출
```

## 시작하기

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경 변수

`.env.example`을 복사하여 `.env` 생성:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. DB 스키마

`database-schema.sql`을 Supabase SQL Editor에서 실행

### 4. 개발 서버

```bash
npm run dev
```

`http://localhost:3000` 접속

### 5. Supabase Auth 설정

1. Authentication > Providers > Email 활성화
2. Authentication > Users > Add User로 계정 생성

## 배포

### Vercel

1. GitHub 연결 후 자동 배포
2. Environment Variables 설정:

| 변수 | 용도 |
|------|------|
| `VITE_SUPABASE_URL` | 프론트엔드 빌드 |
| `VITE_SUPABASE_ANON_KEY` | 프론트엔드 빌드 |
| `SUPABASE_URL` | Cron API |
| `SUPABASE_ANON_KEY` | Cron API |
| `CRON_SECRET` | Cron 엔드포인트 보호 |

### Supabase Edge Functions

```bash
npx supabase functions deploy sync-reservations
npx supabase functions deploy send-notification --no-verify-jwt
```

Edge Function secrets:

```bash
npx supabase secrets set KAKAOWORK_BOT_KEY=your_bot_key
npx supabase secrets set SMBIZ_ADMIN_ID=your_id
npx supabase secrets set SMBIZ_ADMIN_PW=your_pw
```

## 장비 목록

| 장비 | 코드 | 색상 |
|------|------|------|
| AS360 | `as360` | Purple |
| MICRO | `micro` | Blue |
| XL | `xl` | Green |
| XXL | `xxl` | Amber |
| Alpha Desk | `desk` | Pink |
| Alpha Table | `table` | Cyan |
| Compact | `compact` | Indigo |

## 라이센스

MIT
