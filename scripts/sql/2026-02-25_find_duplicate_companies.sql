-- 사업자번호 정규화 후 중복 기업 찾기
-- 하이픈 제거 → 10자리 숫자로 통일 → 같은 번호끼리 그룹화

WITH normalized AS (
  SELECT
    id,
    name,
    representative,
    business_number,
    REPLACE(business_number, '-', '') AS biz_num_clean,
    industry,
    contact,
    district,
    company_size,
    created_at
  FROM companies
  WHERE business_number IS NOT NULL
    AND REPLACE(business_number, '-', '') != ''
),
duplicates AS (
  SELECT biz_num_clean
  FROM normalized
  GROUP BY biz_num_clean
  HAVING COUNT(*) > 1
)
SELECT
  n.biz_num_clean AS "정규화 사업자번호",
  n.id,
  n.name AS "회사명",
  n.representative AS "대표자",
  n.business_number AS "원본 사업자번호",
  n.industry AS "업종",
  n.contact AS "연락처",
  n.district AS "지역구",
  n.company_size AS "기업규모",
  (SELECT COUNT(*) FROM reservations r WHERE r.company_id = n.id) AS "예약수"
FROM normalized n
INNER JOIN duplicates d ON n.biz_num_clean = d.biz_num_clean
ORDER BY n.biz_num_clean, n.created_at;
