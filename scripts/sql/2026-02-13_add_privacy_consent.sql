-- SMBIZ Dashboard
-- Migration: add privacy_consent to satisfaction_surveys
-- Date: 2026-02-13

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'satisfaction_surveys'
  ) THEN
    ALTER TABLE public.satisfaction_surveys
      ADD COLUMN IF NOT EXISTS privacy_consent CHAR(1);

    ALTER TABLE public.satisfaction_surveys
      DROP CONSTRAINT IF EXISTS satisfaction_surveys_privacy_consent_check;

    ALTER TABLE public.satisfaction_surveys
      ADD CONSTRAINT satisfaction_surveys_privacy_consent_check
      CHECK (privacy_consent IN ('Y', 'N'));

    -- Backfill existing submitted surveys to Y.
    -- If you need stricter policy, remove this update and handle manually.
    UPDATE public.satisfaction_surveys
    SET privacy_consent = 'Y'
    WHERE submitted_at IS NOT NULL
      AND privacy_consent IS NULL;
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
--   AND column_name = 'privacy_consent';
--
-- SELECT privacy_consent, COUNT(*)
-- FROM public.satisfaction_surveys
-- GROUP BY privacy_consent
-- ORDER BY privacy_consent;
--
-- ------------------------------
-- Rollback (manual)
-- ------------------------------
-- ALTER TABLE public.satisfaction_surveys
--   DROP CONSTRAINT IF EXISTS satisfaction_surveys_privacy_consent_check;
-- ALTER TABLE public.satisfaction_surveys
--   DROP COLUMN IF EXISTS privacy_consent;
