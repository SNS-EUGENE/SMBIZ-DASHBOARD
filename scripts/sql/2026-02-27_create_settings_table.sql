-- settings 테이블: 앱 설정 키-값 저장 (카카오워크 수신자 등)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- 초기 데이터: 카카오워크 수신자 (빈 배열)
INSERT INTO settings (key, value)
VALUES ('kakaowork_recipients', '{"emails": []}')
ON CONFLICT (key) DO NOTHING;
