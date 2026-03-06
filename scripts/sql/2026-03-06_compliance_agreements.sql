-- ================================================
-- compliance_agreements 테이블 생성
-- 2026-03-06
-- ================================================
-- 이용자 준수사항 동의 기록 저장

CREATE TABLE IF NOT EXISTS compliance_agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  agreed BOOLEAN NOT NULL DEFAULT false,
  signed_date DATE NOT NULL,
  company_name TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  signature_data TEXT,  -- base64 PNG 서명 이미지
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 예약당 하나의 동의서
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_agreements_reservation
  ON compliance_agreements(reservation_id);

-- RLS
ALTER TABLE compliance_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_select_public"
  ON compliance_agreements FOR SELECT
  USING (true);

CREATE POLICY "compliance_insert_public"
  ON compliance_agreements FOR INSERT
  WITH CHECK (true);

CREATE POLICY "compliance_modify_authenticated"
  ON compliance_agreements FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "compliance_delete_authenticated"
  ON compliance_agreements FOR DELETE
  USING (auth.role() = 'authenticated');
