/**
 * 기업명 통합 매핑 테이블
 * 여러 형태로 입력된 같은 기업을 하나의 정식 명칭으로 통합
 */

export const companyNameMapping = {
  // 무아미
  '(주(무아미': '무아미',

  // 인랩
  '(주)네이처인랩': '인랩',
  '주식회사 인랩': '인랩',

  // 베라카그룹
  '(주)베라카그룹': '㈜베라카그룹',

  // 이요크리에이션
  '(주)이요크리에이션': '㈜이요크리에이션',

  // 피엘그룹
  '(주)피엘그룹': '피엘그룹',

  // 폼리쉬 (formlich)
  'formlich': 'formlich(폼리쉬)',
  '폼리쉬(formlich)': 'formlich(폼리쉬)',

  // 고차원
  '고차원': '주식회사 고차원',
  '고차원(리슬립)': '주식회사 고차원',
  '고차원(리슬립) ': '주식회사 고차원',

  // 다니엘척
  '다니엘척': '다니엘척(Daniel Chuck)',

  // 벨라짜
  '벨라짜': '벨라짜 주식회사',

  // 엠엔에이치에스
  '엠엔에이치에스': '주식회사 엠엔에이치에스',

  // 유하우스건축사사무소
  '유하우스건축사사무소': '유하우스건축사사무소(주)',

  // 스몰링앤굿모닝
  '(주)스몰링엔굿모닝 SYLK': '스몰링앤굿모닝',

  // 로브나인 (오타 수정)
  '로브나인': '노브나인',

  // 아이아이주얼리 (표기 통일)
  '아이아이주얼리': '아이아이쥬얼리',
};

/**
 * 기업명 정규화 함수
 * @param {string} name - 원본 기업명
 * @returns {string} - 정규화된 기업명
 */
export function normalizeCompanyName(name) {
  if (!name) return name;

  // 공백 제거
  const trimmed = name.trim();

  // 매핑 테이블에 있으면 정식 명칭 반환
  if (companyNameMapping[trimmed]) {
    return companyNameMapping[trimmed];
  }

  return trimmed;
}

/**
 * 모든 고유한 정식 기업명 목록 가져오기
 */
export function getUniqueCompanyNames(names) {
  const uniqueNames = new Set();

  names.forEach(name => {
    const normalized = normalizeCompanyName(name);
    uniqueNames.add(normalized);
  });

  return Array.from(uniqueNames).sort();
}
