-- sync_log 테이블: Edge Function 동기화 이력 기록
-- 2026-02-25

CREATE TABLE IF NOT EXISTS sync_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  mode text NOT NULL DEFAULT 'incremental',
  new_count int DEFAULT 0,
  error_count int DEFAULT 0,
  details jsonb,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

-- 최근 동기화 이력 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON sync_log (started_at DESC);
