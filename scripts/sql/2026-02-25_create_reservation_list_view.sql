-- reservation_list: 예약 관리 페이지용 서버사이드 페이지네이션 뷰
-- 예약 + 기업 + 장비 + 만족도조사 조인을 하나의 플랫 뷰로 제공
-- Supabase PostgREST를 통해 .range(), .eq(), .ilike() 등 서버사이드 필터/정렬/페이지네이션 가능

CREATE OR REPLACE VIEW reservation_list AS
SELECT
  r.id,
  r.company_id,
  r.reservation_date,
  r.time_slot,
  r.status,
  r.attendees,
  r.is_training,
  r.is_seminar,
  r.work_2d,
  r.work_3d,
  r.work_video,
  r.notes,
  r.reserve_idx,
  r.end_date,
  r.start_time,
  r.end_time,
  r.request_notes,
  r.business_license_url,
  r.small_biz_cert_url,
  c.name AS company_name,
  c.industry,
  c.representative,
  c.contact,
  c.district,
  c.business_number,
  c.company_size,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT e.type), NULL) AS equipment_types,
  EXISTS(SELECT 1 FROM satisfaction_surveys ss WHERE ss.reservation_id = r.id) AS has_survey,
  CONCAT_WS(' ', c.name, c.industry, c.representative, r.reservation_date::text) AS search_text
FROM reservations r
LEFT JOIN companies c ON r.company_id = c.id
LEFT JOIN reservation_equipment re ON r.id = re.reservation_id
LEFT JOIN equipment e ON re.equipment_id = e.id
GROUP BY r.id, c.id;
