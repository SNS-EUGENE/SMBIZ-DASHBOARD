-- ================================================
-- reservations 테이블 스크래핑 필드 추가
-- smbiz.sba.kr 데이터 수용을 위한 컬럼 확장
-- ================================================

-- smbiz 원본 예약 ID (중복 방지용 UNIQUE)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reserve_idx VARCHAR(50) UNIQUE;

-- 예약 종료일 (기존에는 reservation_date 하나만 존재)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- 원본 시작/종료 시간 (time_slot은 자동 파생, 원본값 보관)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS start_time VARCHAR(10);

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS end_time VARCHAR(10);

-- 사업자등록증 / 소상공인확인서 Storage URL
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS business_license_url TEXT;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS small_biz_cert_url TEXT;

-- 요청사항 (기존 notes와 별도)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS request_notes TEXT;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reservations_reserve_idx
  ON reservations(reserve_idx);
