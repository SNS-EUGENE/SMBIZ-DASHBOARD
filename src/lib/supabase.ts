import { createClient, PostgrestError } from '@supabase/supabase-js'
import { EQUIPMENT_TYPES } from '../constants'
import { getMonthDateRange } from './dateUtils'
import type {
  Company,
  CompanyInsert,
  CompanyUpdate,
  Equipment,
  Reservation,
  ReservationInsert,
  ReservationUpdate,
  EquipmentType,
  SatisfactionSurvey,
  SurveySubmitInput,
  SurveyCategoryRatings,
  FacilityInspection,
  EquipmentInspection,
} from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials are missing. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'smbiz-dashboard'
    }
  }
})

// ========================================
// API 응답 타입
// ========================================

interface SupabaseResponse<T> {
  data: T | null
  error: PostgrestError | null
}

interface DeleteResponse {
  error: PostgrestError | null
}

interface IsBlockedResponse {
  isBlocked: boolean
  blockedUntil?: string | null
  error: PostgrestError | null
}

interface NoShowResponse {
  data: { id: string; status: string } | null
  blockedUntil?: string
  error: PostgrestError | null
}

interface ReservationFilters {
  startDate?: string
  endDate?: string
  status?: string
}

// 통계 관련 타입
interface EquipmentStatResult {
  equipment_name: string
  reservation_count: number
  unique_companies: number
  total_hours: number
}

interface DistrictStatResult {
  district: string
  total_reservations: number
  unique_companies: number
  total_hours: number
  companies: Set<string>
}

interface IndustryStatResult {
  industry: string
  total_reservations: number
  unique_companies: number
  total_hours: number
  companies: Set<string>
}

interface DailyTrendResult {
  date: string
  morning: number
  afternoon: number
  total: number
}

// Supabase join 결과 타입
interface ReservationWithCompany {
  id: string
  company_id: string
  reservation_date: string
  time_slot: string
  status: string
  attendees: number
  is_training: boolean
  is_seminar: boolean
  work_2d: number
  work_3d: number
  work_video: number
  notes: string | null
  reserve_idx: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  request_notes: string | null
  business_license_url: string | null
  small_biz_cert_url: string | null
  companies: {
    name: string
    industry: string
    representative: string
    contact: string
    district: string | null
    business_number: string | null
    company_size: string | null
    created_at: string
  } | null
}

interface ReservationEquipmentJoin {
  reservation_id: string
  equipment: {
    type: string
    name: string
  } | null
}

interface DailyReservationView {
  id: string
  company_id: string
  reservation_date: string
  time_slot: string
  status: string
  equipment_types: string[] | null
  district: string | null
  industry: string | null
  company_name: string | null
  contact: string | null
}

interface SatisfactionSurveyRow {
  id: string
  reservation_id: string | null
  submitted_at: string | null
  overall_rating: number | null
  category_ratings: unknown
  comment: string | null
  improvement_request: string | null
  privacy_consent?: string | null
  feedback_status?: string | null
  feedback_note?: string | null
}

const SURVEY_SELECT_COLUMNS = `
  id,
  reservation_id,
  submitted_at,
  overall_rating,
  category_ratings,
  comment,
  improvement_request,
  privacy_consent,
  feedback_status,
  feedback_note
`

const SURVEY_SELECT_COLUMNS_NO_FEEDBACK = `
  id,
  reservation_id,
  submitted_at,
  overall_rating,
  category_ratings,
  comment,
  improvement_request,
  privacy_consent
`

const SURVEY_SELECT_COLUMNS_FALLBACK = `
  id,
  reservation_id,
  submitted_at,
  overall_rating,
  category_ratings,
  comment,
  improvement_request
`

const isSurveyTableMissingError = (error: PostgrestError): boolean => {
  // 42P01: PostgreSQL "undefined_table" — 테이블 자체가 없는 경우만
  return error.code === '42P01'
}

const isMissingColumnError = (error: PostgrestError, column: string): boolean => {
  return (
    error.code === '42703' &&
    (error.message.includes(column) || error.details?.includes(column) === true)
  )
}

const normalizeCategoryRatings = (value: unknown): SurveyCategoryRatings | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const normalized: SurveyCategoryRatings = {}
  Object.entries(raw).forEach(([key, rawValue]) => {
    if (typeof rawValue === 'number') {
      normalized[key as keyof SurveyCategoryRatings] = rawValue
    }
  })
  return Object.keys(normalized).length > 0 ? normalized : null
}

const toSurveyModel = (item: SatisfactionSurveyRow): SatisfactionSurvey => {
  const consent = item.privacy_consent === 'Y' || item.privacy_consent === 'N'
    ? item.privacy_consent
    : null

  const feedbackStatus =
    item.feedback_status === 'unreviewed' ||
    item.feedback_status === 'reviewed' ||
    item.feedback_status === 'action_taken'
      ? item.feedback_status
      : null

  return {
    id: item.id,
    reservation_id: item.reservation_id,
    submitted_at: item.submitted_at,
    overall_rating: item.overall_rating,
    category_ratings: normalizeCategoryRatings(item.category_ratings),
    comment: item.comment,
    improvement_request: item.improvement_request,
    privacy_consent: consent,
    feedback_status: feedbackStatus,
    feedback_note: item.feedback_note || null,
  }
}

// Flattened reservation (API가 반환하는 형태)
export interface FlatReservation {
  id: string
  company_id: string
  reservation_date: string
  time_slot: string
  status: string
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
  // smbiz 스크래핑 필드
  reserve_idx?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  request_notes?: string | null
  business_license_url?: string | null
  small_biz_cert_url?: string | null
  // 기업 추가 정보
  business_number?: string | null
  company_size?: string | null
  // 만족도조사 시행 여부
  has_survey: boolean
}

// Supabase .in() URL 길이 제한 회피를 위한 배치 크기
const BATCH_SIZE = 100

// Helper functions
export const api = {
  // Companies
  companies: {
    getAll: async (): Promise<SupabaseResponse<Company[]>> => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name')
      return { data, error }
    },

    getById: async (id: string): Promise<SupabaseResponse<Company>> => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single()
      return { data, error }
    },

    create: async (company: CompanyInsert): Promise<SupabaseResponse<Company>> => {
      const { data, error } = await supabase
        .from('companies')
        .insert([company])
        .select()
        .single()
      return { data, error }
    },

    update: async (id: string, updates: CompanyUpdate): Promise<SupabaseResponse<Company>> => {
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    delete: async (id: string): Promise<DeleteResponse> => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id)
      return { error }
    },

    // 노쇼 처리 - 1주일 예약 금지
    markNoShow: async (id: string): Promise<SupabaseResponse<Company>> => {
      const blockedUntil = new Date()
      blockedUntil.setDate(blockedUntil.getDate() + 7)

      const { data, error } = await supabase
        .from('companies')
        .update({ blocked_until: blockedUntil.toISOString() })
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    // 예약 금지 해제
    unblock: async (id: string): Promise<SupabaseResponse<Company>> => {
      const { data, error } = await supabase
        .from('companies')
        .update({ blocked_until: null })
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    // 차단된 기업 목록 조회
    getBlocked: async (): Promise<SupabaseResponse<Company[]>> => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .gt('blocked_until', new Date().toISOString())
        .order('blocked_until', { ascending: true })
      return { data, error }
    },

    // 특정 기업이 차단 상태인지 확인
    isBlocked: async (id: string): Promise<IsBlockedResponse> => {
      const { data, error } = await supabase
        .from('companies')
        .select('blocked_until')
        .eq('id', id)
        .single()

      if (error) return { isBlocked: false, error }

      const isBlocked = !!(data.blocked_until && new Date(data.blocked_until) > new Date())
      return { isBlocked, blockedUntil: data.blocked_until, error: null }
    },
  },

  // Equipment
  equipment: {
    getAll: async (): Promise<SupabaseResponse<Equipment[]>> => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('type')
      return { data, error }
    },

    getAvailable: async (date: string, timeSlot: string): Promise<SupabaseResponse<Equipment[]>> => {
      // Get all equipment
      const { data: allEquipment, error: equipError } = await supabase
        .from('equipment')
        .select('*')
        .eq('status', 'active')

      if (equipError) return { data: null, error: equipError }

      // Get reserved equipment for the time slot
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select(`
          id,
          reservation_equipment (
            equipment_id
          )
        `)
        .eq('reservation_date', date)
        .eq('time_slot', timeSlot)
        .neq('status', 'cancelled')

      if (resError) return { data: null, error: resError }

      // Filter out reserved equipment
      const reservedIds = new Set(
        (reservations as Array<{ id: string; reservation_equipment: Array<{ equipment_id: string }> }>)
          .flatMap(r => r.reservation_equipment.map(re => re.equipment_id))
      )

      const available = (allEquipment as Equipment[]).filter(eq => !reservedIds.has(eq.id))

      return { data: available, error: null }
    },
  },

  // Reservations
  reservations: {
    getAll: async (filters: ReservationFilters = {}): Promise<SupabaseResponse<FlatReservation[]>> => {
      // reservations 테이블에서 직접 조회하여 company_id 포함
      let query = supabase
        .from('reservations')
        .select(`
          id,
          company_id,
          reservation_date,
          time_slot,
          status,
          attendees,
          is_training,
          is_seminar,
          work_2d,
          work_3d,
          work_video,
          notes,
          reserve_idx,
          end_date,
          start_time,
          end_time,
          request_notes,
          business_license_url,
          small_biz_cert_url,
          companies (
            name,
            industry,
            representative,
            contact,
            district,
            business_number,
            company_size,
            created_at
          )
        `)
        .order('reservation_date', { ascending: false })

      if (filters.startDate) {
        query = query.gte('reservation_date', filters.startDate)
      }

      if (filters.endDate) {
        query = query.lte('reservation_date', filters.endDate)
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const { data: reservations, error: resError } = await query

      if (resError) return { data: null, error: resError }

      const typedReservations = reservations as unknown as ReservationWithCompany[]

      // equipment_types 추가
      const reservationIds = typedReservations.map(r => r.id)

      if (reservationIds.length === 0) {
        return { data: typedReservations.map(r => ({
          ...r,
          company_name: r.companies?.name,
          industry: r.companies?.industry,
          representative: r.companies?.representative,
          contact: r.companies?.contact,
          district: r.companies?.district,
          business_number: r.companies?.business_number ?? null,
          company_size: r.companies?.company_size ?? null,
          company_created_at: r.companies?.created_at ?? null,
          equipment_types: [],
          has_survey: false,
        })), error: null }
      }

      // 장비 데이터를 배치로 조회 (Supabase .in() URL 길이 제한 회피)
      const allEquipmentData: ReservationEquipmentJoin[] = []
      for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
        const batch = reservationIds.slice(i, i + BATCH_SIZE)
        const { data: equipmentData, error: eqErr } = await supabase
          .from('reservation_equipment')
          .select(`
            reservation_id,
            equipment:equipment_id (
              type,
              name
            )
          `)
          .in('reservation_id', batch)

        if (!eqErr && equipmentData) {
          allEquipmentData.push(...(equipmentData as unknown as ReservationEquipmentJoin[]))
        }
      }

      // 만족도조사 시행 여부를 배치로 조회
      const surveyReservationIds = new Set<string>()
      for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
        const batch = reservationIds.slice(i, i + BATCH_SIZE)
        const { data: surveyData } = await supabase
          .from('satisfaction_surveys')
          .select('reservation_id')
          .in('reservation_id', batch)
        if (surveyData) {
          surveyData.forEach((s: { reservation_id: string | null }) => {
            if (s.reservation_id) surveyReservationIds.add(s.reservation_id)
          })
        }
      }

      const equipmentByReservation: Record<string, string[]> = {}
      allEquipmentData.forEach(eq => {
        if (!equipmentByReservation[eq.reservation_id]) {
          equipmentByReservation[eq.reservation_id] = []
        }
        if (eq.equipment) {
          equipmentByReservation[eq.reservation_id].push(eq.equipment.type)
        }
      })

      // 데이터 변환
      const data: FlatReservation[] = typedReservations.map(r => ({
        id: r.id,
        company_id: r.company_id,
        reservation_date: r.reservation_date,
        time_slot: r.time_slot,
        status: r.status,
        attendees: r.attendees,
        is_training: r.is_training,
        is_seminar: r.is_seminar,
        work_2d: r.work_2d,
        work_3d: r.work_3d,
        work_video: r.work_video,
        notes: r.notes,
        reserve_idx: r.reserve_idx,
        end_date: r.end_date,
        start_time: r.start_time,
        end_time: r.end_time,
        request_notes: r.request_notes,
        business_license_url: r.business_license_url,
        small_biz_cert_url: r.small_biz_cert_url,
        company_name: r.companies?.name,
        industry: r.companies?.industry,
        representative: r.companies?.representative,
        contact: r.companies?.contact,
        district: r.companies?.district,
        business_number: r.companies?.business_number ?? null,
        company_size: r.companies?.company_size ?? null,
        company_created_at: r.companies?.created_at ?? null,
        equipment_types: equipmentByReservation[r.id] || [],
        has_survey: surveyReservationIds.has(r.id),
      }))

      return { data, error: null }
    },

    /** 서버사이드 페이지네이션 (reservation_list 뷰 사용) */
    getPaginated: async (params: {
      page: number
      pageSize: number
      statuses?: string[]
      startDate?: string
      endDate?: string
      surveyStatus?: 'all' | 'pending' | 'completed'
      search?: string
      sortField: string
      sortOrder: 'asc' | 'desc'
    }): Promise<SupabaseResponse<{ data: FlatReservation[]; totalCount: number }>> => {
      const { page, pageSize, statuses, startDate, endDate, surveyStatus, search, sortField, sortOrder } = params
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('reservation_list')
        .select('*', { count: 'exact' })

      if (statuses && statuses.length > 0) {
        query = query.in('status', statuses)
      }

      if (startDate) {
        query = query.gte('reservation_date', startDate)
      }
      if (endDate) {
        query = query.lte('reservation_date', endDate)
      }

      if (surveyStatus === 'completed') {
        query = query.eq('has_survey', true)
      } else if (surveyStatus === 'pending') {
        query = query.eq('has_survey', false)
      }

      if (search) {
        query = query.ilike('search_text', `%${search}%`)
      }

      const sortColumn =
        sortField === 'date' ? 'reservation_date'
        : sortField === 'company' ? 'company_name'
        : sortField

      query = query
        .order(sortColumn, { ascending: sortOrder === 'asc' })
        .range(from, to)

      const { data, count, error } = await query

      if (error) return { data: null, error }

      return {
        data: {
          data: (data || []) as unknown as FlatReservation[],
          totalCount: count || 0,
        },
        error: null,
      }
    },

    getByDate: async (date: string): Promise<SupabaseResponse<DailyReservationView[]>> => {
      const { data, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .eq('reservation_date', date)
        .order('time_slot')
      return { data, error }
    },

    create: async (reservation: ReservationInsert, equipmentIds: string[]): Promise<SupabaseResponse<Reservation>> => {
      // Start a transaction
      const { data: newReservation, error: resError } = await supabase
        .from('reservations')
        .insert([reservation])
        .select()
        .single()

      if (resError) return { data: null, error: resError }

      // Add equipment mappings
      const equipmentMappings = equipmentIds.map(equipId => ({
        reservation_id: newReservation.id,
        equipment_id: equipId,
        usage_hours: 4.0
      }))

      const { error: equipError } = await supabase
        .from('reservation_equipment')
        .insert(equipmentMappings)

      if (equipError) {
        // Rollback: delete the reservation
        await supabase.from('reservations').delete().eq('id', newReservation.id)
        return { data: null, error: equipError }
      }

      return { data: newReservation, error: null }
    },

    update: async (
      id: string,
      updates: ReservationUpdate,
      companyId: string | null = null,
      equipmentIds: string[] | null = null
    ): Promise<SupabaseResponse<Reservation>> => {
      // 기존 예약 상태 확인 (노쇼 처리 관련 상태 변경 확인용)
      let previousStatus: string | null = null
      if (updates.status) {
        const { data: existing } = await supabase
          .from('reservations')
          .select('status, company_id')
          .eq('id', id)
          .single()
        previousStatus = existing?.status ?? null
        companyId = companyId || existing?.company_id || null
      }

      const { data, error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data, error }

      // 장비 매핑 업데이트
      if (equipmentIds && equipmentIds.length > 0) {
        // 기존 매핑 삭제
        await supabase
          .from('reservation_equipment')
          .delete()
          .eq('reservation_id', id)

        // 새 매핑 삽입
        const equipmentMappings = equipmentIds.map(equipId => ({
          reservation_id: id,
          equipment_id: equipId,
          usage_hours: 4.0
        }))

        const { error: equipError } = await supabase
          .from('reservation_equipment')
          .insert(equipmentMappings)

        if (equipError) {
          console.error('Failed to update equipment mappings:', equipError)
        }
      }

      // 노쇼로 변경되는 경우 기업 차단 처리
      if (updates.status === 'no_show' && previousStatus !== 'no_show' && companyId) {
        const blockedUntil = new Date()
        blockedUntil.setDate(blockedUntil.getDate() + 7)

        await supabase
          .from('companies')
          .update({ blocked_until: blockedUntil.toISOString() })
          .eq('id', companyId)
      }

      // 노쇼에서 다른 상태로 변경되는 경우 차단 해제
      if (previousStatus === 'no_show' && updates.status !== 'no_show' && companyId) {
        await supabase
          .from('companies')
          .update({ blocked_until: null })
          .eq('id', companyId)
      }

      return { data, error }
    },

    delete: async (id: string): Promise<DeleteResponse> => {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)
      return { error }
    },

    cancel: async (id: string): Promise<SupabaseResponse<Reservation>> => {
      return api.reservations.update(id, { status: 'cancelled' })
    },

    // 노쇼 처리 - 예약 상태 변경 + 기업 차단
    markNoShow: async (id: string, companyId: string): Promise<NoShowResponse> => {
      // 1. 예약 상태를 no_show로 변경
      const { error: resError } = await supabase
        .from('reservations')
        .update({ status: 'no_show' })
        .eq('id', id)

      if (resError) return { data: null, error: resError }

      // 2. 해당 기업 1주일 차단
      const blockedUntil = new Date()
      blockedUntil.setDate(blockedUntil.getDate() + 7)

      const { error: companyError } = await supabase
        .from('companies')
        .update({ blocked_until: blockedUntil.toISOString() })
        .eq('id', companyId)

      if (companyError) {
        console.error('Failed to block company:', companyError)
        return { data: null, error: companyError }
      }

      return { data: { id, status: 'no_show' }, blockedUntil: blockedUntil.toISOString(), error: null }
    },
  },

  // Satisfaction Surveys
  surveys: {
    getByReservationIds: async (
      reservationIds: string[]
    ): Promise<(SupabaseResponse<SatisfactionSurvey[]> & { notConfigured?: boolean })> => {
      if (reservationIds.length === 0) {
        return { data: [], error: null }
      }

      let { data, error } = await supabase
        .from('satisfaction_surveys')
        .select(SURVEY_SELECT_COLUMNS)
        .in('reservation_id', reservationIds)

      // feedback_status/feedback_note 컬럼 없을 때 fallback
      if (error && isMissingColumnError(error, 'feedback_status')) {
        const fb = await supabase
          .from('satisfaction_surveys')
          .select(SURVEY_SELECT_COLUMNS_NO_FEEDBACK)
          .in('reservation_id', reservationIds)
        data = fb.data
        error = fb.error
      }

      if (error && isMissingColumnError(error, 'privacy_consent')) {
        const fallback = await supabase
          .from('satisfaction_surveys')
          .select(SURVEY_SELECT_COLUMNS_FALLBACK)
          .in('reservation_id', reservationIds)

        data = fallback.data
        error = fallback.error
      }

      if (error) {
        if (isSurveyTableMissingError(error)) {
          return { data: [], error: null, notConfigured: true }
        }

        return { data: null, error }
      }

      const normalizedData: SatisfactionSurvey[] = ((data as SatisfactionSurveyRow[]) || []).map(toSurveyModel)

      return { data: normalizedData, error: null }
    },

    submit: async (
      payload: SurveySubmitInput
    ): Promise<(SupabaseResponse<SatisfactionSurvey> & { notConfigured?: boolean })> => {
      const submitData = {
        reservation_id: payload.reservation_id,
        submitted_at: new Date().toISOString(),
        overall_rating: payload.overall_rating,
        category_ratings: payload.category_ratings,
        comment: payload.comment || null,
        improvement_request: payload.improvement_request || null,
        privacy_consent: payload.privacy_consent,
      }

      let { data, error } = await supabase
        .from('satisfaction_surveys')
        .upsert([submitData], { onConflict: 'reservation_id' })
        .select(SURVEY_SELECT_COLUMNS)
        .single()

      // feedback_status/feedback_note 컬럼 없을 때 fallback
      if (error && isMissingColumnError(error, 'feedback_status')) {
        const fb = await supabase
          .from('satisfaction_surveys')
          .upsert([submitData], { onConflict: 'reservation_id' })
          .select(SURVEY_SELECT_COLUMNS_NO_FEEDBACK)
          .single()
        data = fb.data
        error = fb.error
      }

      if (error && isMissingColumnError(error, 'privacy_consent')) {
        const fallbackPayload = {
          reservation_id: payload.reservation_id,
          submitted_at: submitData.submitted_at,
          overall_rating: payload.overall_rating,
          category_ratings: payload.category_ratings,
          comment: payload.comment || null,
          improvement_request: payload.improvement_request || null,
        }

        const fallback = await supabase
          .from('satisfaction_surveys')
          .upsert([fallbackPayload], { onConflict: 'reservation_id' })
          .select(SURVEY_SELECT_COLUMNS_FALLBACK)
          .single()

        data = fallback.data
        error = fallback.error
      }

      if (error) {
        if (isSurveyTableMissingError(error)) {
          return { data: null, error: null, notConfigured: true }
        }
        return { data: null, error }
      }

      const model = toSurveyModel(data as SatisfactionSurveyRow)
      return { data: model, error: null }
    },

    /**
     * 공개 만족도조사 페이지용: 기업명 + 전화번호 뒷4자리로 예약 조회
     * 최근 3개월 이내의 confirmed/completed 예약만 반환
     */
    lookupReservations: async (
      companyName: string,
      phoneLast4: string
    ): Promise<SupabaseResponse<{
      reservationId: string
      reservationDate: string
      timeSlot: string
      companyName: string
      survey: SatisfactionSurvey | null
    }[]>> => {
      // 1) 기업 조회: 이름 일치 + 전화번호 뒷4자리 매칭
      const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id, name, contact')
        .ilike('name', `%${companyName}%`)

      if (companyError) {
        return { data: null, error: companyError }
      }

      // 전화번호 뒷4자리 필터
      const matchedCompanies = (companies || []).filter((c) => {
        const contact = (c.contact || '') as string
        const digits = contact.replace(/[^0-9]/g, '')
        return digits.length >= 4 && digits.slice(-4) === phoneLast4
      })

      if (matchedCompanies.length === 0) {
        return { data: [], error: null }
      }

      const companyIds = matchedCompanies.map((c) => c.id as string)
      const companyNameMap = new Map(matchedCompanies.map((c) => [c.id as string, c.name as string]))

      // 2) 최근 3개월 이내 확정/완료 예약 조회
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      const cutoffDate = threeMonthsAgo.toISOString().split('T')[0]

      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('id, company_id, reservation_date, time_slot, status')
        .in('company_id', companyIds)
        .in('status', ['confirmed', 'completed'])
        .gte('reservation_date', cutoffDate)
        .order('reservation_date', { ascending: false })

      if (resError) {
        return { data: null, error: resError }
      }

      if (!reservations || reservations.length === 0) {
        return { data: [], error: null }
      }

      // 3) 기존 설문 조회
      const reservationIds = reservations.map((r) => r.id as string)
      const surveyResult = await api.surveys.getByReservationIds(reservationIds)
      const surveyMap = new Map<string, SatisfactionSurvey>()
      if (surveyResult.data) {
        surveyResult.data.forEach((s) => {
          if (s.reservation_id) surveyMap.set(s.reservation_id, s)
        })
      }

      const results = reservations.map((r) => ({
        reservationId: r.id as string,
        reservationDate: r.reservation_date as string,
        timeSlot: r.time_slot as string,
        companyName: companyNameMap.get(r.company_id as string) || '',
        survey: surveyMap.get(r.id as string) || null,
      }))

      return { data: results, error: null }
    },

    /**
     * 날짜별 예약 목록 + 설문 상태 조회 (공개 만족도조사 페이지용)
     * confirmed/completed 예약만 반환, 각 예약에 기존 설문이 있는지 표시
     */
    getForDate: async (
      date: string
    ): Promise<SupabaseResponse<{
      reservationId: string
      reservationDate: string
      timeSlot: string
      companyName: string
      contact: string
      survey: SatisfactionSurvey | null
    }[]>> => {
      // 1) 해당 날짜의 confirmed/completed 예약 조회 (daily_reservations 뷰)
      const { data: reservations, error: resError } = await supabase
        .from('daily_reservations')
        .select('*')
        .eq('reservation_date', date)
        .in('status', ['confirmed', 'completed'])
        .order('time_slot')

      if (resError) return { data: null, error: resError }
      if (!reservations || reservations.length === 0) {
        return { data: [], error: null }
      }

      // 2) 기존 설문 조회
      const reservationIds = reservations.map((r) => (r as DailyReservationView).id)
      const surveyResult = await api.surveys.getByReservationIds(reservationIds)
      const surveyMap = new Map<string, SatisfactionSurvey>()
      if (surveyResult.data) {
        surveyResult.data.forEach((s) => {
          if (s.reservation_id) surveyMap.set(s.reservation_id, s)
        })
      }

      const results = (reservations as DailyReservationView[]).map((r) => ({
        reservationId: r.id,
        reservationDate: r.reservation_date,
        timeSlot: r.time_slot,
        companyName: r.company_name || '(알 수 없음)',
        contact: r.contact || '',
        survey: surveyMap.get(r.id) || null,
      }))

      return { data: results, error: null }
    },

    /** 피드백 상태/메모 업데이트 */
    updateFeedback: async (
      surveyId: string,
      feedbackStatus: string,
      feedbackNote: string | null
    ): Promise<SupabaseResponse<SatisfactionSurvey>> => {
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .update({
          feedback_status: feedbackStatus,
          feedback_note: feedbackNote,
        })
        .eq('id', surveyId)
        .select(SURVEY_SELECT_COLUMNS)
        .single()

      if (error) return { data: null, error }
      return { data: toSurveyModel(data as SatisfactionSurveyRow), error: null }
    },

    /** 만족도조사 삭제 */
    delete: async (surveyId: string): Promise<SupabaseResponse<null>> => {
      const { error } = await supabase
        .from('satisfaction_surveys')
        .delete()
        .eq('id', surveyId)
      if (error) return { data: null, error }
      return { data: null, error: null }
    },
  },

  // Inspections (점검 관리)
  inspections: {
    getFacilityByDateRange: async (
      startDate: string,
      endDate: string
    ): Promise<SupabaseResponse<FacilityInspection[]>> => {
      const { data, error } = await supabase
        .from('facility_inspections')
        .select('*')
        .gte('inspection_date', startDate)
        .lte('inspection_date', endDate)
        .order('inspection_date')
      return { data, error }
    },

    upsertFacilityCheck: async (
      inspectionDate: string,
      checks: Record<string, boolean>,
      inspector?: string | null,
      notes?: string | null
    ): Promise<SupabaseResponse<FacilityInspection>> => {
      const { data, error } = await supabase
        .from('facility_inspections')
        .upsert(
          { inspection_date: inspectionDate, checks, inspector, notes },
          { onConflict: 'inspection_date' }
        )
        .select()
        .single()
      return { data, error }
    },

    getEquipmentByMonth: async (
      year: number,
      month: number
    ): Promise<SupabaseResponse<EquipmentInspection[]>> => {
      const { data, error } = await supabase
        .from('equipment_inspections')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .order('week_number')
      return { data, error }
    },

    upsertEquipmentCheck: async (
      year: number,
      month: number,
      weekNumber: number,
      checks: Record<string, boolean>,
      inspector?: string | null,
      notes?: string | null
    ): Promise<SupabaseResponse<EquipmentInspection>> => {
      const { data, error } = await supabase
        .from('equipment_inspections')
        .upsert(
          { year, month, week_number: weekNumber, checks, inspector, notes },
          { onConflict: 'year,month,week_number' }
        )
        .select()
        .single()
      return { data, error }
    },
  },

  // Settings (key-value store)
  settings: {
    get: async <T = unknown>(key: string): Promise<SupabaseResponse<T>> => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .single()

      if (error) return { data: null, error }
      return { data: (data.value as T) ?? null, error: null }
    },

    set: async <T = unknown>(key: string, value: T): Promise<SupabaseResponse<null>> => {
      const { error } = await supabase
        .from('settings')
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      return { data: null, error }
    },
  },

  // Statistics - 실제 데이터 기반 통계
  stats: {
    // 월별 예약 데이터 조회 (work_2d, work_3d, work_video 포함)
    getMonthlyReservations: async (year: number, month: number): Promise<SupabaseResponse<FlatReservation[]>> => {
      const { startDate, endDate } = getMonthDateRange(year, month)

      // reservations 테이블에서 직접 조회하여 work_2d, work_3d, work_video 포함
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select(`
          id,
          company_id,
          reservation_date,
          time_slot,
          status,
          work_2d,
          work_3d,
          work_video,
          attendees,
          is_training,
          is_seminar,
          companies (
            name,
            industry,
            district,
            representative,
            contact
          )
        `)
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)
        .order('reservation_date')

      if (resError) return { data: null, error: resError }

      const typedReservations = reservations as unknown as ReservationWithCompany[]

      // equipment_types 추가를 위해 reservation_equipment 조회
      const reservationIds = typedReservations.map(r => r.id)

      if (reservationIds.length === 0) {
        return { data: typedReservations.map(r => ({
          ...r,
          work_2d: r.work_2d || 0,
          work_3d: r.work_3d || 0,
          work_video: r.work_video || 0,
          company_name: r.companies?.name,
          industry: r.companies?.industry,
          district: r.companies?.district,
          representative: r.companies?.representative,
          contact: r.companies?.contact,
          equipment_types: [],
        })), error: null }
      }

      // 장비 데이터를 배치로 조회
      const allEqData: ReservationEquipmentJoin[] = []
      for (let i = 0; i < reservationIds.length; i += BATCH_SIZE) {
        const batch = reservationIds.slice(i, i + BATCH_SIZE)
        const { data: equipmentData, error: eqError } = await supabase
          .from('reservation_equipment')
          .select(`
            reservation_id,
            equipment:equipment_id (
              type,
              name
            )
          `)
          .in('reservation_id', batch)

        if (eqError) return { data: null, error: eqError }
        if (equipmentData) {
          allEqData.push(...(equipmentData as unknown as ReservationEquipmentJoin[]))
        }
      }

      // 예약별 장비 타입 그룹화
      const equipmentByReservation: Record<string, string[]> = {}
      allEqData.forEach(eq => {
        if (!equipmentByReservation[eq.reservation_id]) {
          equipmentByReservation[eq.reservation_id] = []
        }
        if (eq.equipment) {
          equipmentByReservation[eq.reservation_id].push(eq.equipment.type)
        }
      })

      // 데이터 변환
      const data: FlatReservation[] = typedReservations.map(r => ({
        id: r.id,
        company_id: r.company_id,
        reservation_date: r.reservation_date,
        time_slot: r.time_slot,
        status: r.status,
        work_2d: r.work_2d || 0,
        work_3d: r.work_3d || 0,
        work_video: r.work_video || 0,
        attendees: r.attendees,
        is_training: r.is_training,
        is_seminar: r.is_seminar,
        notes: null,
        company_name: r.companies?.name,
        industry: r.companies?.industry,
        district: r.companies?.district,
        representative: r.companies?.representative,
        contact: r.companies?.contact,
        equipment_types: equipmentByReservation[r.id] || [],
      }))

      return { data, error: null }
    },

    // 장비별 통계 계산
    getEquipmentStats: async (year: number, month: number): Promise<SupabaseResponse<EquipmentStatResult[]>> => {
      const { startDate, endDate } = getMonthDateRange(year, month)

      // 해당 월의 모든 예약 조회
      const { data: reservations, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)

      if (error) return { data: null, error }

      const typedReservations = reservations as DailyReservationView[]

      // 장비별 통계 계산
      const equipmentTypes: EquipmentType[] = EQUIPMENT_TYPES
      const stats: EquipmentStatResult[] = equipmentTypes.map(equipment => {
        const filtered = typedReservations.filter(r =>
          r.equipment_types?.includes(equipment)
        )
        const uniqueCompanies = new Set(filtered.map(r => r.company_id))

        return {
          equipment_name: equipment,
          reservation_count: filtered.length,
          unique_companies: uniqueCompanies.size,
          total_hours: filtered.length * 4, // 오전/오후 각 4시간
        }
      })

      return { data: stats, error: null }
    },

    // 자치구별 통계
    getDistrictStats: async (year: number, month: number): Promise<SupabaseResponse<Array<Omit<DistrictStatResult, 'companies'>>>> => {
      const { startDate, endDate } = getMonthDateRange(year, month)

      const { data: reservations, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)

      if (error) return { data: null, error }

      const typedReservations = reservations as DailyReservationView[]

      // 자치구별 그룹화
      const districtMap: Record<string, DistrictStatResult> = {}
      typedReservations.forEach(r => {
        const district = r.district || '미지정'
        if (!districtMap[district]) {
          districtMap[district] = {
            district,
            total_reservations: 0,
            companies: new Set(),
            unique_companies: 0,
            total_hours: 0,
          }
        }
        districtMap[district].total_reservations++
        districtMap[district].companies.add(r.company_id)
        districtMap[district].total_hours += 4
      })

      const stats = Object.values(districtMap)
        .map(d => ({
          district: d.district,
          total_reservations: d.total_reservations,
          unique_companies: d.companies.size,
          total_hours: d.total_hours,
        }))
        .sort((a, b) => b.total_reservations - a.total_reservations)

      return { data: stats, error: null }
    },

    // 업종별 통계
    getIndustryStats: async (year: number, month: number): Promise<SupabaseResponse<Array<Omit<IndustryStatResult, 'companies'>>>> => {
      const { startDate, endDate } = getMonthDateRange(year, month)

      const { data: reservations, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)

      if (error) return { data: null, error }

      const typedReservations = reservations as DailyReservationView[]

      // 업종별 그룹화
      const industryMap: Record<string, IndustryStatResult> = {}
      typedReservations.forEach(r => {
        const industry = r.industry || '미지정'
        if (!industryMap[industry]) {
          industryMap[industry] = {
            industry,
            total_reservations: 0,
            companies: new Set(),
            unique_companies: 0,
            total_hours: 0,
          }
        }
        industryMap[industry].total_reservations++
        industryMap[industry].companies.add(r.company_id)
        industryMap[industry].total_hours += 4
      })

      const stats = Object.values(industryMap)
        .map(d => ({
          industry: d.industry,
          total_reservations: d.total_reservations,
          unique_companies: d.companies.size,
          total_hours: d.total_hours,
        }))
        .sort((a, b) => b.total_hours - a.total_hours)
        .slice(0, 10) // 상위 10개

      return { data: stats, error: null }
    },

    // 일별 예약 추이
    getDailyTrend: async (year: number, month: number): Promise<SupabaseResponse<DailyTrendResult[]>> => {
      const { startDate, endDate } = getMonthDateRange(year, month)

      const { data: reservations, error } = await supabase
        .from('daily_reservations')
        .select('reservation_date, time_slot')
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)

      if (error) return { data: null, error }

      const typedReservations = reservations as Array<{ reservation_date: string; time_slot: string }>

      // 날짜별 그룹화
      const dateMap: Record<string, DailyTrendResult> = {}
      typedReservations.forEach(r => {
        const date = r.reservation_date
        if (!dateMap[date]) {
          dateMap[date] = { date, morning: 0, afternoon: 0, total: 0 }
        }
        if (r.time_slot === 'morning') {
          dateMap[date].morning++
        } else {
          dateMap[date].afternoon++
        }
        dateMap[date].total++
      })

      const stats = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
      return { data: stats, error: null }
    },
  },
}

// ── Auth ──────────────────────────────────────────────

export const auth = {
  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
    supabase.auth.onAuthStateChange(cb),
}
