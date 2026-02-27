-- ================================================
-- companies.company_size CHECK 제약 수정
-- smbiz에서 '소공인' 분류가 사용되므로 허용 목록에 추가
-- ================================================

-- 기존 CHECK 제약 삭제 후 재생성
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_company_size_check;

ALTER TABLE companies ADD CONSTRAINT companies_company_size_check
  CHECK (company_size IN ('소기업', '중기업', '대기업', '스타트업', '1인기업', '소공인'));
