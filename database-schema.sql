-- ================================================
-- SMBIZ 디지털 콘텐츠 제작실 예약 시스템
-- Supabase Database Schema
-- ================================================

-- 1. 기업 정보 테이블
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  representative VARCHAR(100) NOT NULL,
  business_number VARCHAR(20) UNIQUE,
  company_size VARCHAR(20) CHECK (company_size IN ('소기업', '중기업', '대기업', '스타트업', '1인기업')),
  industry VARCHAR(100) NOT NULL,
  contact VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  district VARCHAR(50), -- 서울시 자치구
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_district ON companies(district);
CREATE INDEX idx_companies_industry ON companies(industry);

-- ================================================

-- 2. 장비 정보 테이블
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('AS360', 'MICRO', 'XL', 'XXL', '알파데스크', '알파테이블', 'Compact')),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 장비 데이터 삽입
INSERT INTO equipment (name, type, description) VALUES
  ('AS360-01', 'AS360', 'VR 360도 촬영 장비'),
  ('MICRO-01', 'MICRO', '마이크로 정밀 작업 장비'),
  ('XL-01', 'XL', '대형 출력 장비'),
  ('XXL-01', 'XXL', '초대형 출력 장비'),
  ('알파데스크-01', '알파데스크', '데스크형 작업 공간'),
  ('알파테이블-01', '알파테이블', '테이블형 작업 공간'),
  ('Compact-01', 'Compact', '컴팩트 작업 장비');

-- ================================================

-- 3. 예약 테이블
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  time_slot VARCHAR(10) NOT NULL CHECK (time_slot IN ('morning', 'afternoon')), -- 09-13 / 14-18
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),

  -- 작업 유형별 시간 (분 단위)
  work_2d INTEGER DEFAULT 0,
  work_3d INTEGER DEFAULT 0,
  work_video INTEGER DEFAULT 0,
  work_advanced INTEGER DEFAULT 0,

  -- 참석 인원
  attendees INTEGER DEFAULT 1,

  -- 교육/세미나
  is_training BOOLEAN DEFAULT false,
  is_seminar BOOLEAN DEFAULT false,

  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_company ON reservations(company_id);
CREATE INDEX idx_reservations_status ON reservations(status);

-- 복합 인덱스 (날짜 + 시간대로 예약 조회 최적화)
CREATE INDEX idx_reservations_date_slot ON reservations(reservation_date, time_slot);

-- ================================================

-- 4. 예약-장비 매핑 테이블 (N:N 관계)
CREATE TABLE reservation_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  usage_hours DECIMAL(5,2) DEFAULT 4.0, -- 기본 4시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 한 예약에서 같은 장비 중복 방지
  UNIQUE(reservation_id, equipment_id)
);

-- 인덱스
CREATE INDEX idx_reservation_equipment_reservation ON reservation_equipment(reservation_id);
CREATE INDEX idx_reservation_equipment_equipment ON reservation_equipment(equipment_id);

-- ================================================

-- 5. 통계 뷰 (가동률 계산용)
CREATE OR REPLACE VIEW equipment_utilization AS
SELECT
  e.id as equipment_id,
  e.name as equipment_name,
  e.type as equipment_type,
  DATE_TRUNC('month', r.reservation_date) as month,
  COUNT(DISTINCT r.id) as reservation_count,
  COUNT(DISTINCT r.company_id) as unique_companies,
  SUM(re.usage_hours) as total_hours,
  COUNT(DISTINCT r.reservation_date) as working_days,
  -- 가동률 계산: (총 사용시간) / (근무일수 × 8시간) × 100
  ROUND(
    (SUM(re.usage_hours)::DECIMAL / NULLIF(COUNT(DISTINCT r.reservation_date) * 8, 0)) * 100,
    2
  ) as utilization_rate
FROM equipment e
LEFT JOIN reservation_equipment re ON e.id = re.equipment_id
LEFT JOIN reservations r ON re.reservation_id = r.id AND r.status = 'completed'
GROUP BY e.id, e.name, e.type, DATE_TRUNC('month', r.reservation_date);

-- ================================================

-- 6. 자치구별 통계 뷰
CREATE OR REPLACE VIEW district_statistics AS
SELECT
  c.district,
  DATE_TRUNC('month', r.reservation_date) as month,
  COUNT(DISTINCT c.id) as unique_companies,
  COUNT(r.id) as total_reservations,
  SUM(re.usage_hours) as total_hours,
  COUNT(DISTINCT CASE WHEN r.is_training THEN r.id END) as training_count,
  COUNT(DISTINCT CASE WHEN r.is_seminar THEN r.id END) as seminar_count
FROM companies c
LEFT JOIN reservations r ON c.id = r.company_id AND r.status = 'completed'
LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
GROUP BY c.district, DATE_TRUNC('month', r.reservation_date);

-- ================================================

-- 7. 업종별 통계 뷰
CREATE OR REPLACE VIEW industry_statistics AS
SELECT
  c.industry,
  DATE_TRUNC('month', r.reservation_date) as month,
  COUNT(DISTINCT c.id) as unique_companies,
  COUNT(r.id) as total_reservations,
  SUM(r.work_2d) as total_2d_minutes,
  SUM(r.work_3d) as total_3d_minutes,
  SUM(r.work_video) as total_video_minutes,
  SUM(re.usage_hours) as total_hours
FROM companies c
LEFT JOIN reservations r ON c.id = r.company_id AND r.status = 'completed'
LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
GROUP BY c.industry, DATE_TRUNC('month', r.reservation_date);

-- ================================================

-- 8. 일별 예약 현황 뷰 (메인 페이지용)
CREATE OR REPLACE VIEW daily_reservations AS
SELECT
  r.id,
  r.reservation_date,
  r.time_slot,
  r.status,
  c.name as company_name,
  c.industry,
  c.representative,
  c.contact,
  ARRAY_AGG(e.type) as equipment_types,
  ARRAY_AGG(e.name) as equipment_names,
  SUM(re.usage_hours) as total_hours,
  r.attendees,
  r.is_training,
  r.is_seminar
FROM reservations r
JOIN companies c ON r.company_id = c.id
LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
LEFT JOIN equipment e ON re.equipment_id = e.id
GROUP BY r.id, r.reservation_date, r.time_slot, r.status, c.name, c.industry, c.representative, c.contact, r.attendees, r.is_training, r.is_seminar;

-- ================================================

-- 9. Row Level Security (RLS) 설정
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_equipment ENABLE ROW LEVEL SECURITY;

-- 관리자 정책 (모든 권한)
CREATE POLICY "Enable all access for authenticated users" ON companies
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON equipment
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON reservations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON reservation_equipment
  FOR ALL USING (auth.role() = 'authenticated');

-- 읽기 전용 정책 (뷰어 역할용)
CREATE POLICY "Enable read access for all users" ON companies
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON equipment
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON reservations
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON reservation_equipment
  FOR SELECT USING (true);

-- ================================================

-- 10. 트리거 함수 (updated_at 자동 갱신)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================

-- 11. 예약 충돌 방지 함수
CREATE OR REPLACE FUNCTION check_reservation_conflict()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  -- 같은 날짜, 같은 시간대에 같은 장비가 이미 예약되어 있는지 확인
  SELECT COUNT(*) INTO conflict_count
  FROM reservations r
  JOIN reservation_equipment re ON r.id = re.reservation_id
  WHERE r.reservation_date = NEW.reservation_date
    AND r.time_slot = NEW.time_slot
    AND r.status NOT IN ('cancelled')
    AND re.equipment_id IN (
      SELECT equipment_id FROM reservation_equipment WHERE reservation_id = NEW.id
    )
    AND r.id != NEW.id;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION '해당 시간대에 이미 예약된 장비가 있습니다.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_reservation_conflict BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION check_reservation_conflict();

-- ================================================

-- 12. 샘플 데이터 (테스트용)
-- 기업 데이터
INSERT INTO companies (name, representative, business_number, company_size, industry, contact, district) VALUES
  ('위드넷', '최철웅', '123-45-67890', '소기업', 'XXL', '010-5920-8423', '종로구'),
  ('오띠오', '윤예진', '123-45-67891', '소기업', '수제화', '010-5146-4497', '강남구'),
  ('폼리쉬', '강도완', '123-45-67892', '소기업', '의류봉제', '010-7470-3330', '성동구'),
  ('인랩', '손석봉', '123-45-67893', '소기업', 'Table', '010-3578-2889', '종로구'),
  ('주식회사 고차원', '차동근', '123-45-67894', '중기업', 'Compact', '010-9542-1316', '강남구');

-- 예약 데이터 (오늘 날짜 기준)
INSERT INTO reservations (company_id, reservation_date, time_slot, status, work_2d, work_3d, attendees)
SELECT
  id,
  CURRENT_DATE,
  'morning',
  'confirmed',
  120,
  60,
  2
FROM companies LIMIT 3;

INSERT INTO reservations (company_id, reservation_date, time_slot, status, work_2d, work_video, attendees)
SELECT
  id,
  CURRENT_DATE,
  'afternoon',
  'confirmed',
  180,
  120,
  3
FROM companies OFFSET 2 LIMIT 2;

-- 장비 예약 매핑
INSERT INTO reservation_equipment (reservation_id, equipment_id, usage_hours)
SELECT
  r.id,
  e.id,
  4.0
FROM reservations r
CROSS JOIN equipment e
WHERE r.status = 'confirmed'
LIMIT 10;
