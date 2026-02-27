-- ================================================
-- 예약 자동 완료 처리 (confirmed → completed)
-- 예약 날짜+시간대가 지나면 자동으로 상태 전환
-- 대상: confirmed 상태만 (cancelled, no_show, pending 제외)
-- ================================================

-- 1. 자동 완료 함수 (충돌 체크 트리거 우회)
CREATE OR REPLACE FUNCTION auto_complete_reservations()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 상태만 변경하므로 충돌 체크 트리거 일시 비활성화
  SET session_replication_role = 'replica';

  UPDATE reservations
  SET status = 'completed',
      updated_at = NOW()
  WHERE status = 'confirmed'
    AND (
      -- 오전(morning) 슬롯: 해당 날짜 13:00 KST 이후
      (time_slot = 'morning' AND (reservation_date + TIME '13:00') AT TIME ZONE 'Asia/Seoul' < NOW())
      OR
      -- 오후(afternoon) 슬롯: 해당 날짜 18:00 KST 이후
      (time_slot = 'afternoon' AND (reservation_date + TIME '18:00') AT TIME ZONE 'Asia/Seoul' < NOW())
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- 트리거 복원
  SET session_replication_role = 'origin';

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. pg_cron 확장 활성화 (이미 활성화되어 있으면 무시됨)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. 매 시간 정각에 실행되는 cron job 등록
-- Supabase에서는 cron.schedule을 사용
SELECT cron.schedule(
  'auto-complete-reservations',   -- job 이름
  '0 * * * *',                    -- 매 시간 정각
  $$SELECT auto_complete_reservations()$$
);

-- ================================================
-- 확인용 쿼리 (실행 후 삭제 가능)
-- SELECT * FROM cron.job WHERE jobname = 'auto-complete-reservations';
-- SELECT auto_complete_reservations(); -- 수동 실행 테스트
-- ================================================
