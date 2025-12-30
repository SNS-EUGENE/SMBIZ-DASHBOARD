# 🚀 SMBIZ 대시보드 설치 가이드

## 📋 사전 준비

### 1. Node.js 설치
1. [Node.js 공식 사이트](https://nodejs.org/) 접속
2. **LTS 버전** (권장) 다운로드 및 설치
3. 설치 확인:
   ```bash
   node --version
   # v18.0.0 이상

   npm --version
   # 9.0.0 이상
   ```

### 2. Git 설치 (선택사항)
1. [Git 공식 사이트](https://git-scm.com/) 접속
2. 다운로드 및 설치

---

## 🗄️ Supabase 설정

### 1. Supabase 프로젝트 생성
1. [Supabase](https://supabase.com/) 접속 및 로그인
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - **Name**: smbiz-dashboard
   - **Database Password**: 안전한 비밀번호 설정
   - **Region**: Northeast Asia (Seoul)
4. "Create new project" 클릭
5. 프로젝트 생성 완료 (1-2분 소요)

### 2. 데이터베이스 스키마 적용
1. Supabase 대시보드 왼쪽 메뉴에서 **SQL Editor** 클릭
2. "+ New query" 클릭
3. 프로젝트 폴더의 `database-schema.sql` 파일 내용 전체 복사
4. SQL Editor에 붙여넣기
5. **RUN** 버튼 클릭 (또는 Ctrl+Enter)
6. 성공 메시지 확인

### 3. API 키 확인
1. Supabase 대시보드 왼쪽 메뉴에서 **Settings** 클릭
2. **API** 메뉴 클릭
3. 다음 정보 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGc...` (긴 토큰 문자열)

---

## ⚙️ 프로젝트 설정

### 1. 프로젝트 폴더로 이동
```bash
cd c:\Users\master\Documents\kshrd\smbiz-dashboard
```

### 2. 의존성 설치
```bash
npm install
```

설치 시간: 약 2-3분 (인터넷 속도에 따라 다름)

### 3. 환경 변수 설정
1. `.env.example` 파일을 `.env`로 복사:
   ```bash
   # Windows
   copy .env.example .env

   # Mac/Linux
   cp .env.example .env
   ```

2. `.env` 파일 열기 (메모장 또는 VSCode)

3. Supabase 정보 입력:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. 파일 저장

---

## 🎯 실행

### 개발 서버 시작
```bash
npm run dev
```

브라우저가 자동으로 열리고 다음 주소로 접속:
```
http://localhost:3000
```

### 빌드 (배포용)
```bash
npm run build
```

빌드된 파일은 `dist` 폴더에 생성됩니다.

### 빌드 미리보기
```bash
npm run preview
```

---

## ✅ 설치 확인 체크리스트

- [ ] Node.js 설치 완료 (v18+)
- [ ] npm install 완료
- [ ] Supabase 프로젝트 생성
- [ ] database-schema.sql 실행 완료
- [ ] .env 파일 설정 완료
- [ ] npm run dev 실행 성공
- [ ] 브라우저에서 대시보드 접속 확인

---

## 🐛 문제 해결

### 1. "npm: command not found"
- Node.js가 제대로 설치되지 않았습니다
- Node.js를 재설치하고 컴퓨터를 재시작하세요

### 2. "Failed to fetch reservations" 오류
- Supabase URL 또는 Anon Key가 잘못되었습니다
- `.env` 파일의 설정을 다시 확인하세요
- Supabase 프로젝트가 활성 상태인지 확인하세요

### 3. 빈 화면만 보임
- 브라우저 콘솔(F12)을 열어 에러 메시지 확인
- `.env` 파일이 올바른 위치에 있는지 확인
- 개발 서버를 재시작하세요 (Ctrl+C 후 npm run dev)

### 4. 데이터베이스 연결 오류
- database-schema.sql이 올바르게 실행되었는지 확인
- Supabase 대시보드 > Table Editor에서 테이블 생성 확인:
  - companies
  - equipment
  - reservations
  - reservation_equipment

### 5. Port 3000 already in use
- 다른 프로그램이 3000 포트를 사용 중입니다
- 해당 프로그램을 종료하거나
- vite.config.js에서 포트 번호 변경:
  ```js
  server: {
    port: 3001, // 다른 포트로 변경
  }
  ```

---

## 📚 다음 단계

1. **샘플 데이터 확인**
   - Supabase 대시보드 > Table Editor에서 샘플 데이터 확인
   - 메인 페이지에서 예약 현황 확인

2. **데이터 추가**
   - 관리자 페이지에서 기업 정보 추가
   - 예약 생성 (현재는 Supabase Table Editor 사용)

3. **커스터마이징**
   - `tailwind.config.js`에서 컬러 변경
   - 컴포넌트 수정 및 확장

4. **배포**
   - Vercel, Netlify 등 호스팅 서비스 활용
   - GitHub에서 프로젝트 관리

---

## 📞 지원

문제가 지속되면 다음 정보와 함께 문의하세요:
- 운영체제 (Windows/Mac/Linux)
- Node.js 버전
- 에러 메시지 스크린샷
- 브라우저 콘솔 로그
