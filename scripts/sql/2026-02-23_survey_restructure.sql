-- SMBIZ Dashboard
-- Migration: add feedback_status and feedback_note to satisfaction_surveys
-- Date: 2026-02-23

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'satisfaction_surveys'
  ) THEN
    -- 피드백 관리용 상태 컬럼
    ALTER TABLE public.satisfaction_surveys
      ADD COLUMN IF NOT EXISTS feedback_status VARCHAR(20) DEFAULT 'unreviewed';

    ALTER TABLE public.satisfaction_surveys
      DROP CONSTRAINT IF EXISTS satisfaction_surveys_feedback_status_check;

    ALTER TABLE public.satisfaction_surveys
      ADD CONSTRAINT satisfaction_surveys_feedback_status_check
      CHECK (feedback_status IN ('unreviewed', 'reviewed', 'action_taken'));

    -- 피드백 관리자 메모 컬럼
    ALTER TABLE public.satisfaction_surveys
      ADD COLUMN IF NOT EXISTS feedback_note TEXT;

    -- 인덱스
    CREATE INDEX IF NOT EXISTS idx_surveys_feedback_status
      ON satisfaction_surveys(feedback_status);

    -- 기존 데이터 기본값 설정
    UPDATE public.satisfaction_surveys
    SET feedback_status = 'unreviewed'
    WHERE feedback_status IS NULL;
  END IF;
END $$;

COMMIT;

-- ------------------------------
-- Verification queries
-- ------------------------------
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'satisfaction_surveys'
--   AND column_name IN ('feedback_status', 'feedback_note');
--
-- SELECT feedback_status, COUNT(*)
-- FROM public.satisfaction_surveys
-- GROUP BY feedback_status;
