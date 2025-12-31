# SMBIZ Dashboard - 프로젝트 현황

> 최종 업데이트: 2025-12-31 (2차 업데이트)

## 📊 프로젝트 개요

디지털 콘텐츠 제작실 예약 관리 시스템
- **기술 스택**: React + Vite + Supabase + Tailwind CSS
- **디자인**: macOS 스타일 glassmorphism
- **상태**: 개발 중 (메인 페이지 완료, 통계/관리 페이지 미구현)

---

## ✅ 완료된 작업

### 1. UI/UX 전면 개편
- [x] macOS 공식 UI kit 참고한 glassmorphism 디자인 적용
- [x] Pretendard 폰트 로딩 최적화 (FOUT 방지)
- [x] 클릭 기반 인터랙션 (툴팁, 달력)
- [x] 툴팁/달력 외부 클릭시 자동 닫힘 구현
- [x] 오전/오후 타임슬롯별 예약 타임라인 뷰

### 2. 성능 최적화
- [x] React.memo를 활용한 시계 컴포넌트 리렌더링 격리
- [x] hour12: false 설정으로 시간 표시 깜빡임 완전 제거
- [x] 불필요한 리렌더링 최소화

### 3. z-index/레이아웃 이슈 해결
- [x] Portal 컴포넌트 구현 (document.body에 렌더링)
- [x] 툴팁이 항상 최상단에 표시되도록 수정
- [x] backdrop-filter로 인한 stacking context 문제 해결
- [x] 오후 예약 툴팁은 위로, 오전 예약 툴팁은 아래로 표시

### 4. 데이터 처리
- [x] Excel 데이터 업로드 스크립트 (`scripts/upload-excel-data.js`)
- [x] 회사명 매핑 및 정규화 (`scripts/company-name-mapping.js`)
- [x] 중복 체크 기능 (`scripts/check-duplicate-companies.js`)
- [x] 데이터 분석 도구 (`scripts/analyze-excel.js`, `scripts/deep-analyze-excel.js`)

### 5. 디자인 시스템
- [x] Tailwind 컬러 팔레트 전면 개편 (macOS 다크 모드 스타일)
- [x] glassmorphism 효과 강화 (backdrop-blur-2xl)
- [x] 개선된 텍스트 대비 및 계층 구조
- [x] 장비별 컬러 시스템 (AS360, MICRO, XL, XXL, 알파데스크, 알파테이블, Compact)

### 6. 컴포넌트 구조
```
src/
├── components/
│   ├── Calendar.jsx          ✅ 달력 컴포넌트
│   ├── Layout.jsx            ✅ 레이아웃 (사이드바)
│   ├── Portal.jsx            ✅ Portal 래퍼
│   └── TimelineView.jsx      ✅ 타임라인 뷰
├── pages/
│   ├── MainPage.jsx          ✅ 메인 페이지
│   ├── StatsPage.jsx         ❌ 미구현
│   └── AdminPage.jsx         ❌ 미구현
└── lib/
    └── supabase.js           ✅ Supabase 클라이언트
```

---

## ⚠️ 알려진 이슈

### 1. 🔴 엑셀 옵션 파싱 오류로 인한 장비 매핑 누락 (심각)

**증상**
- 상단 예약 건수: 표시됨 (554건)
- 타임라인: 일부만 표시됨 (66건만 장비 매핑 있음)
- **88%의 예약이 타임라인에 표시되지 않음!**

**근본 원인 (2025-12-31 분석 완료)**
```
📋 전체 예약 수 (reservations 테이블): 554건
🔗 장비 매핑이 있는 예약: 66건
❌ 장비 매핑이 없는 예약: 488건
```

**원인 분석**
1. `facilityReserve.xlsx`의 옵션 컬럼 포맷: `"MICRO /  / AS360"` (슬래시로 구분)
2. `upload-excel-data.js`의 `parseEquipmentOptions()` 함수: `split('\n')` (줄바꿈으로 파싱)
3. **포맷 불일치로 장비 정보가 파싱되지 않음**

**문제 코드** (`scripts/upload-excel-data.js:78-86`)
```javascript
function parseEquipmentOptions(optionsStr) {
  if (!optionsStr) return []
  return optionsStr
    .split('\n')  // ❌ 문제: 실제 데이터는 '/'로 구분됨
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => equipmentTypeMapping[t] || t)
    .filter(t => ['XXL', 'XL', 'MICRO', 'AS360', 'Compact', '알파데스크', '알파테이블'].includes(t))
}
```

**실제 엑셀 옵션 데이터 예시**
```
"XL" - 68건
"알파테이블" - 61건
"MICRO /  / AS360" - 32건
"XXL /  / 알파테이블" - 25건
"패션스튜디오 /  / XXL /  / Compact /  / 알파테이블 / " - 25건
```

**해결 방안**
1. **옵션 A (권장)**: 업로드 스크립트 수정 후 DB 클리어 & 재업로드
   - `parseEquipmentOptions()` 함수에서 `/`와 `\n` 둘 다 지원
   - DB 완전 초기화 후 다시 업로드
2. **옵션 B**: 기존 예약 유지, reservation_equipment 매핑만 재생성
   - 기존 reservations 테이블은 유지
   - 엑셀 재파싱하여 reservation_equipment만 추가

**우선순위**: 🔴 매우 높음 - 전체 예약의 88%가 표시 안 됨

---

### 2. 디버그 로그 제거 필요

**위치**: `src/components/TimelineView.jsx:28-36`

```javascript
// 제거 필요
if (hasTimeSlot && reservations.length > 0 && equipment === 'AS360') {
  console.log('Debug equipment_types:', {
    company: r.company_name,
    looking_for: equipment,
    actual_array: r.equipment_types,
    array_contents: JSON.stringify(r.equipment_types),
    hasEquipment
  })
}
```

**우선순위**: 🟡 중간 - 프로덕션 배포 전 필수

---

## 📋 해야 할 작업

### 🔴 우선순위: 긴급 (다음 세션에서 즉시 해결)

1. **엑셀 옵션 파싱 수정 & DB 재업로드** ⭐ 최우선
   - [ ] `parseEquipmentOptions()` 함수 수정 (`/` 구분자 지원)
   - [ ] 해결 방안 결정 (A: DB 클리어 후 재업로드 vs B: 매핑만 추가)
   - [ ] DB 데이터 초기화 (선택시)
   - [ ] 데이터 재업로드
   - [ ] 타임라인 정상 표시 확인

2. **디버그 로그 제거**
   - [ ] TimelineView.jsx의 console.log 제거

---

### 🟠 우선순위: 중간 (핵심 기능)

3. **통계 페이지 구현** (`/stats`)
   - [ ] 날짜별 예약 통계
   - [ ] 장비별 사용률
   - [ ] 월별/주별 트렌드
   - [ ] Chart.js 또는 Recharts 연동

4. **관리 페이지 구현** (`/admin`)
   - [ ] 예약 추가 폼
   - [ ] 예약 수정 기능
   - [ ] 예약 삭제 기능
   - [ ] 회사 정보 관리

5. **예약 CRUD 기능**
   - [ ] 예약 생성 API 연동
   - [ ] 예약 수정 API 연동
   - [ ] 예약 삭제 API 연동
   - [ ] 예약 상태 변경 (confirmed, pending, completed, cancelled)

---

### 🟡 우선순위: 낮음 (부가 기능)

6. **검색 및 필터**
   - [ ] 회사명으로 예약 검색
   - [ ] 장비별 필터
   - [ ] 상태별 필터
   - [ ] 날짜 범위 검색

7. **데이터 시각화**
   - [ ] 장비 사용률 차트
   - [ ] 월별 예약 트렌드
   - [ ] 인기 시간대 분석
   - [ ] 회사별 이용 통계

8. **반응형 & 접근성**
   - [ ] 모바일 반응형 최적화
   - [ ] 태블릿 레이아웃
   - [ ] 키보드 네비게이션
   - [ ] 스크린 리더 지원

9. **내보내기 기능**
   - [ ] Excel 내보내기
   - [ ] PDF 보고서
   - [ ] 인쇄 최적화

10. **기타 개선사항**
    - [ ] 다크모드 토글 (현재 항상 다크)
    - [ ] 알림/토스트 시스템
    - [ ] 오프라인 지원
    - [ ] 에러 바운더리 추가

---

## 🔧 기술 부채

### 즉시 해결 필요
- equipment_types null 처리
- 디버그 로그 제거

### 중기 계획
- TypeScript 마이그레이션 검토
- 에러 처리 개선
- 로딩 상태 UX 개선
- 테스트 코드 작성

### 장기 계획
- 오프라인 캐싱 전략
- PWA 전환
- 실시간 동기화 (Supabase Realtime)
- 다국어 지원

---

## 📁 프로젝트 구조

```
smbiz-dashboard/
├── src/
│   ├── components/
│   │   ├── Calendar.jsx          # 달력 컴포넌트
│   │   ├── Layout.jsx            # 레이아웃 (사이드바 + 메인)
│   │   ├── Portal.jsx            # React Portal 래퍼
│   │   └── TimelineView.jsx      # 예약 타임라인 뷰
│   ├── pages/
│   │   ├── MainPage.jsx          # 메인 페이지 (예약 현황)
│   │   ├── StatsPage.jsx         # 통계 페이지 (미구현)
│   │   └── AdminPage.jsx         # 관리 페이지 (미구현)
│   ├── lib/
│   │   └── supabase.js           # Supabase 클라이언트 & API
│   ├── styles/
│   │   └── index.css             # 글로벌 스타일
│   ├── App.jsx                   # 라우터 설정
│   └── main.jsx                  # 엔트리 포인트
├── scripts/
│   ├── upload-excel-data.js      # Excel 데이터 업로드
│   ├── company-name-mapping.js   # 회사명 매핑
│   ├── check-duplicate-companies.js  # 중복 체크
│   ├── analyze-excel.js          # 데이터 분석
│   └── deep-analyze-excel.js     # 심층 분석
├── tailwind.config.js            # Tailwind 설정
├── vite.config.js                # Vite 설정
└── package.json                  # 의존성
```

---

## 🎨 디자인 시스템

### 컬러 팔레트 (macOS Dark)
```javascript
// Background
bg-primary: #0F0F0F
bg-secondary: #1C1C1E
bg-tertiary: #2C2C2E
bg-elevated: #3A3A3C
bg-hover: #48484A

// Text
text-primary: #FFFFFF
text-secondary: #EBEBF5
text-tertiary: #8E8E93
text-muted: #636366

// Border
border: rgba(255, 255, 255, 0.1)
border-hover: rgba(255, 255, 255, 0.15)
border-focus: #FF6363

// Status
primary: #FF6363 (Raycast Red)
success: #00D9A5
warning: #FFB84D
danger: #FF6B6B

// Equipment
AS360: #8B5CF6 (Purple)
MICRO: #3B82F6 (Blue)
XL: #10B981 (Green)
XXL: #F59E0B (Amber)
알파데스크: #EC4899 (Pink)
알파테이블: #06B6D4 (Cyan)
Compact: #6366F1 (Indigo)
```

### 타이포그래피
- **Primary Font**: Pretendard
- **Mono Font**: SF Mono, Monaco, Menlo

### Glassmorphism 효과
- `backdrop-blur-2xl`: 주요 카드 및 패널
- `bg-{color}/60`: 60% 투명도
- `shadow-glass`: 커스텀 glassmorphism 섀도우

---

## 🚀 다음 단계

### 1단계: 버그 수정
1. equipment_types null 처리 방안 결정
2. 디버그 로그 제거
3. Git 커밋 & 푸시

### 2단계: 통계 페이지
1. 기본 레이아웃 구성
2. 날짜별 예약 수 차트
3. 장비별 사용률 차트
4. 상태별 통계

### 3단계: 관리 페이지
1. 예약 추가 폼 UI
2. 예약 수정 모달
3. 예약 삭제 확인 다이얼로그
4. Supabase API 연동

---

## 📞 연락처

- **개발**: Claude Sonnet 4.5
- **프로젝트**: SMBIZ Dashboard
- **Repository**: https://github.com/SNS-EUGENE/SMBIZ-DASHBOARD
