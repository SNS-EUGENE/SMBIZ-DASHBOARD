-- 3572번 예약을 삭제하여 재동기화 가능하게 함
-- (장비 파싱 버그로 장비 매핑 없이 동기화되었음)
-- 실행 후 설정 페이지에서 "새 예약 동기화" 클릭

DELETE FROM reservation_equipment
WHERE reservation_id = (SELECT id FROM reservations WHERE reserve_idx = '3572');

DELETE FROM reservations WHERE reserve_idx = '3572';
