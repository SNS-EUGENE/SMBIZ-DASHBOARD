/**
 * 만족도조사 설정
 * SMBIZ 디지털콘텐츠제작실 만족도조사 항목 정의
 *
 * 문항 추가/수정/삭제 시 이 파일만 수정하면 됩니다.
 */

import type { SurveyCategoryKey, FeedbackStatus } from '../types'

// ========================================
// 만족도 척도 (1-5점)
// ========================================

export const SATISFACTION_LEVELS = [
  { value: 5, label: '매우 만족' },
  { value: 4, label: '만족' },
  { value: 3, label: '보통' },
  { value: 2, label: '불만족' },
  { value: 1, label: '매우 불만족' },
] as const

export const SATISFACTION_LEVEL_LABELS: Record<number, string> = {
  5: '매우 만족',
  4: '만족',
  3: '보통',
  2: '불만족',
  1: '매우 불만족',
}

// ========================================
// 항목별 만족도 질문 (Q1-Q6, 순서대로 표시)
// ========================================

export const SURVEY_CATEGORIES: { key: SurveyCategoryKey; label: string }[] = [
  { key: 'facility', label: '시설 만족도는 어느 정도입니까?' },
  { key: 'staff_kindness', label: '직원 친절도는 어느 정도입니까?' },
  { key: 'staff_expertise', label: '직원의 장비 전문성은 어느 정도입니까?' },
  { key: 'booking', label: '예약 만족도는 어느 정도입니까?' },
  { key: 'cleanliness', label: '청결 상태는 어느 정도입니까?' },
  { key: 'supplies', label: '비품 만족도는 어느 정도입니까?' },
]

export const SURVEY_CATEGORY_ORDER: SurveyCategoryKey[] =
  SURVEY_CATEGORIES.map((c) => c.key)

// 카테고리 키 → 짧은 라벨 (통계 페이지용)
export const SURVEY_CATEGORY_LABELS: Record<string, string> = {
  // 현재 항목
  facility: '시설 만족도',
  staff_kindness: '직원 친절도',
  staff_expertise: '장비 전문성',
  booking: '예약 만족도',
  cleanliness: '청결 상태',
  supplies: '비품 만족도',
  // 레거시 항목 (기존 데이터 호환성)
  overall: '전반적 만족도',
  equipment: '시설 및 장비',
  staff: '직원 응대',
  booking_process: '예약 프로세스',
  cost: '대관 비용',
}

// ========================================
// Q7: 스튜디오 경로 (다중 선택)
// ========================================

export const STUDIO_REFERRAL_OPTIONS = [
  { value: 'SNS', label: 'SNS' },
  { value: '옥외 광고', label: '옥외 광고' },
  { value: '지인 소개', label: '지인 소개' },
  { value: '공공서비스 예약 시스템', label: '공공서비스 예약 시스템' },
  { value: '기타', label: '기타' },
] as const

// ========================================
// Q8: 이용을 통해 도움이 된 부분 (다중 선택)
// ========================================

export const STUDIO_BENEFIT_OPTIONS = [
  { value: '판매 증진', label: '판매 증진' },
  { value: '제품 홍보', label: '제품 홍보' },
  { value: '인지도 상승', label: '인지도 상승' },
  { value: '비용 절감', label: '비용 절감' },
] as const

// ========================================
// 피드백 관리 상태
// ========================================

export const FEEDBACK_STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'unreviewed', label: '미확인' },
  { value: 'reviewed', label: '확인완료' },
  { value: 'action_taken', label: '조치완료' },
]

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  unreviewed: '미확인',
  reviewed: '확인완료',
  action_taken: '조치완료',
}
