-- satisfaction_surveys RLS 정책 수정
-- 현재: INSERT만 공개, UPDATE/DELETE는 authenticated 필요
-- 수정: anon 키로도 UPDATE/DELETE 허용 (개발/관리자 대시보드용)
--
-- 배포 시 인증 시스템 도입 후 이 정책들을 제거하고
-- authenticated 전용 정책으로 교체해야 합니다.

-- 기존 제한적 정책 삭제
DROP POLICY IF EXISTS "surveys_modify_authenticated" ON satisfaction_surveys;
DROP POLICY IF EXISTS "surveys_delete_authenticated" ON satisfaction_surveys;

-- 공개 UPDATE 정책 (anon 키 허용)
CREATE POLICY "surveys_update_public" ON satisfaction_surveys
  FOR UPDATE USING (true) WITH CHECK (true);

-- 공개 DELETE 정책 (anon 키 허용)
CREATE POLICY "surveys_delete_public" ON satisfaction_surveys
  FOR DELETE USING (true);
