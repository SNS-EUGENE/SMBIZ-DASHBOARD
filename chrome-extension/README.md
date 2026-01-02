# SMBIZ 예약 데이터 추출기 (Chrome Extension)

서울도시제조허브 관리자 페이지(smbiz.sba.kr)에서 예약 데이터를 추출하여 SMBIZ Dashboard에 붙여넣기할 수 있는 크롬 확장 프로그램입니다.

## 설치 방법

1. Chrome 브라우저에서 `chrome://extensions` 페이지로 이동
2. 우측 상단의 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 이 폴더(`chrome-extension`)를 선택

## 아이콘 추가

확장 프로그램을 정상적으로 사용하려면 `icons` 폴더에 다음 크기의 PNG 아이콘을 추가해야 합니다:

- `icon16.png` (16x16 픽셀)
- `icon48.png` (48x48 픽셀)
- `icon128.png` (128x128 픽셀)

간단한 아이콘을 직접 만들거나, 온라인 아이콘 생성기를 사용하세요.

## 사용 방법

1. [smbiz.sba.kr](https://smbiz.sba.kr) 관리자 페이지에 로그인
2. 시설예약 > 시설예약관리에서 예약 상세 페이지로 이동
3. 페이지 우측 상단의 "SMBIZ Dashboard로 복사" 버튼 클릭
4. SMBIZ Dashboard의 예약 추가 페이지에서 입력 필드 클릭 후 Ctrl+V로 붙여넣기

## 추출되는 데이터

- **예약 정보**: 날짜, 시간대, 선택된 장비
- **기업 정보**: 기업명, 대표자, 사업자등록번호, 업종, 연락처
- **작업량**: 2D(Still), 3D(360), 영상 작업 수량

## 기술 사양

- Manifest Version: 3
- 필요 권한: activeTab, clipboardWrite
- 호스트 권한: https://smbiz.sba.kr/*
