// ========================================
// 기본 타입
// ========================================

export type TimeSlot = 'morning' | 'afternoon'
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type EquipmentStatus = 'active' | 'maintenance' | 'inactive'
export type EquipmentType = 'AS360' | 'MICRO' | 'XL' | 'XXL' | '알파데스크' | '알파테이블' | 'Compact'
export type CompanySize = '소기업' | '중기업' | '대기업' | '스타트업' | '1인기업'

// ========================================
// 엔티티 타입
// ========================================

export interface Company {
  id: string
  name: string
  representative: string
  business_number: string | null
  company_size: CompanySize | null
  industry: string
  contact: string
  email: string | null
  address: string | null
  district: string | null
  blocked_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Equipment {
  id: string
  name: string
  type: EquipmentType
  description: string | null
  status: EquipmentStatus
  created_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  company_id: string
  reservation_date: string
  time_slot: TimeSlot
  status: ReservationStatus
  work_2d: number
  work_3d: number
  work_video: number
  work_advanced: number
  attendees: number
  is_training: boolean
  is_seminar: boolean
  // smbiz.sba.kr 스크래핑 필드
  reserve_idx: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  business_license_url: string | null
  small_biz_cert_url: string | null
  request_notes: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** daily_reservations 뷰에서 가져온 확장 예약 데이터 */
export interface ReservationWithDetails extends Reservation {
  company_name: string
  industry: string
  representative: string
  contact: string
  district?: string
  equipment_types: string[]
  equipment_names: string[]
  total_hours: number
  // 기업 추가 정보 (companies join)
  business_number?: string | null
  company_size?: string | null
}

/** 통계/대시보드 집계용 예약 레코드 (조인 평탄화 형태) */
export interface ReservationAnalyticsRecord {
  id: string
  company_id: string
  reservation_date: string
  time_slot: TimeSlot
  status: ReservationStatus
  attendees: number
  is_training: boolean
  is_seminar: boolean
  work_2d: number
  work_3d: number
  work_video: number
  notes: string | null
  company_name?: string
  industry?: string
  representative?: string
  contact?: string
  district?: string | null
  company_created_at?: string | null
  equipment_types: string[]
}

// 현재 설문 카테고리 (6개 평점 항목)
export type SurveyCategoryKey =
  | 'facility'
  | 'staff_kindness'
  | 'staff_expertise'
  | 'booking'
  | 'cleanliness'
  | 'supplies'
  // 레거시 (기존 데이터 호환)
  | 'overall'
  | 'equipment'
  | 'staff'
  | 'cost'
  | 'booking_process'

export type SurveyCategoryRatings = Partial<Record<SurveyCategoryKey, number>>

export type PrivacyConsent = 'Y' | 'N'

export type FeedbackStatus = 'unreviewed' | 'reviewed' | 'action_taken'

export interface SatisfactionSurvey {
  id: string
  reservation_id: string | null
  submitted_at: string | null
  overall_rating: number | null
  category_ratings: SurveyCategoryRatings | null
  comment: string | null
  improvement_request: string | null
  privacy_consent: PrivacyConsent | null
  feedback_status: FeedbackStatus | null
  feedback_note: string | null
}

export interface SurveySubmitInput {
  reservation_id: string
  overall_rating: number
  category_ratings: SurveyCategoryRatings
  comment?: string | null
  improvement_request?: string | null
  privacy_consent: PrivacyConsent
}

export interface ReservationEquipment {
  id: string
  reservation_id: string
  equipment_id: string
  usage_hours: number
  created_at: string
}

// ========================================
// Insert / Update 타입
// ========================================

export type CompanyInsert = Omit<Company, 'id' | 'created_at' | 'updated_at'>
export type CompanyUpdate = Partial<CompanyInsert>

export type ReservationInsert = Omit<Reservation, 'id' | 'created_at' | 'updated_at'>
export type ReservationUpdate = Partial<ReservationInsert>

// ========================================
// 통계 타입
// ========================================

export interface EquipmentStat {
  type: string
  count: number
  hours: number
}

export interface DistrictStat {
  district: string
  total_reservations: number
  unique_companies: number
  total_hours: number
}

export interface IndustryStat {
  industry: string
  total_reservations: number
  unique_companies: number
}

export interface CompanyStat {
  name: string
  total_reservations: number
  total_hours: number
}

export interface ContentStat {
  name: string
  value: number
}

export interface DailyTrend {
  day: number
  reservations: number
  companies: number
}

// ========================================
// API 응답 타입
// ========================================

export interface ApiResponse<T> {
  data: T | null
  error: { message: string } | null
}

// ========================================
// UI 타입
// ========================================

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

export interface StatusConfig {
  label: string
  class: string
}

export interface NavLink {
  path: string
  label: string
  icon: React.FC
}

// ========================================
// 점검 타입
// ========================================

export interface FacilityInspection {
  id: string
  inspection_date: string
  checks: Record<string, boolean>
  inspector: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EquipmentInspection {
  id: string
  year: number
  month: number
  week_number: number
  checks: Record<string, boolean>
  inspector: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
