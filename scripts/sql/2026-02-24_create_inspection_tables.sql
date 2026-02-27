-- ================================================
-- 점검 관리 테이블 (시설 점검 + 장비 점검)
-- ================================================

-- 1. 시설 점검 테이블 (일별 1 row)
CREATE TABLE facility_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_date DATE NOT NULL UNIQUE,
  checks JSONB NOT NULL DEFAULT '{}',
  inspector VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_facility_inspections_date ON facility_inspections(inspection_date);

-- 2. 장비 점검 테이블 (년/월/주차별 1 row)
CREATE TABLE equipment_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 6),
  checks JSONB NOT NULL DEFAULT '{}',
  inspector VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year, month, week_number)
);

CREATE INDEX idx_equipment_inspections_ym ON equipment_inspections(year, month);

-- 3. RLS 정책
ALTER TABLE facility_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_inspections_select_public" ON facility_inspections
  FOR SELECT USING (true);
CREATE POLICY "facility_inspections_modify_public" ON facility_inspections
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "equipment_inspections_select_public" ON equipment_inspections
  FOR SELECT USING (true);
CREATE POLICY "equipment_inspections_modify_public" ON equipment_inspections
  FOR ALL USING (true)
  WITH CHECK (true);

-- 4. updated_at 트리거
CREATE TRIGGER update_facility_inspections_updated_at BEFORE UPDATE ON facility_inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_inspections_updated_at BEFORE UPDATE ON equipment_inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();