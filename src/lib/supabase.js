import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials are missing. Please check your .env file.')
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

// Helper functions
export const api = {
  // Companies
  companies: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name')
      return { data, error }
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single()
      return { data, error }
    },

    create: async (company) => {
      const { data, error } = await supabase
        .from('companies')
        .insert([company])
        .select()
        .single()
      return { data, error }
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id)
      return { error }
    },

    // 노쇼 처리 - 1주일 예약 금지
    markNoShow: async (id) => {
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
    unblock: async (id) => {
      const { data, error } = await supabase
        .from('companies')
        .update({ blocked_until: null })
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    // 차단된 기업 목록 조회
    getBlocked: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .gt('blocked_until', new Date().toISOString())
        .order('blocked_until', { ascending: true })
      return { data, error }
    },

    // 특정 기업이 차단 상태인지 확인
    isBlocked: async (id) => {
      const { data, error } = await supabase
        .from('companies')
        .select('blocked_until')
        .eq('id', id)
        .single()

      if (error) return { isBlocked: false, error }

      const isBlocked = data.blocked_until && new Date(data.blocked_until) > new Date()
      return { isBlocked, blockedUntil: data.blocked_until, error: null }
    },
  },

  // Equipment
  equipment: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('type')
      return { data, error }
    },

    getAvailable: async (date, timeSlot) => {
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
        reservations.flatMap(r => r.reservation_equipment.map(re => re.equipment_id))
      )

      const available = allEquipment.filter(eq => !reservedIds.has(eq.id))

      return { data: available, error: null }
    },
  },

  // Reservations
  reservations: {
    getAll: async (filters = {}) => {
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
          companies (
            name,
            industry,
            representative,
            contact,
            district
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

      // equipment_types 추가
      const reservationIds = reservations.map(r => r.id)

      const { data: equipmentData } = await supabase
        .from('reservation_equipment')
        .select(`
          reservation_id,
          equipment:equipment_id (
            type,
            name
          )
        `)
        .in('reservation_id', reservationIds)

      const equipmentByReservation = {}
      equipmentData?.forEach(eq => {
        if (!equipmentByReservation[eq.reservation_id]) {
          equipmentByReservation[eq.reservation_id] = []
        }
        if (eq.equipment) {
          equipmentByReservation[eq.reservation_id].push(eq.equipment.type)
        }
      })

      // 데이터 변환
      const data = reservations.map(r => ({
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
        company_name: r.companies?.name,
        industry: r.companies?.industry,
        representative: r.companies?.representative,
        contact: r.companies?.contact,
        district: r.companies?.district,
        equipment_types: equipmentByReservation[r.id] || [],
      }))

      return { data, error: null }
    },

    getByDate: async (date) => {
      const { data, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .eq('reservation_date', date)
        .order('time_slot')
      return { data, error }
    },

    create: async (reservation, equipmentIds) => {
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

    update: async (id, updates, companyId = null) => {
      // 기존 예약 상태 확인 (노쇼 처리 관련 상태 변경 확인용)
      let previousStatus = null
      if (updates.status) {
        const { data: existing } = await supabase
          .from('reservations')
          .select('status, company_id')
          .eq('id', id)
          .single()
        previousStatus = existing?.status
        companyId = companyId || existing?.company_id
      }

      const { data, error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data, error }

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

    delete: async (id) => {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)
      return { error }
    },

    cancel: async (id) => {
      return api.reservations.update(id, { status: 'cancelled' })
    },

    // 노쇼 처리 - 예약 상태 변경 + 기업 차단
    markNoShow: async (id, companyId) => {
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

  // Statistics - 실제 데이터 기반 통계
  stats: {
    // 월별 예약 데이터 조회 (work_2d, work_3d, work_video 포함)
    getMonthlyReservations: async (year, month) => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

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

      // equipment_types 추가를 위해 reservation_equipment 조회
      const reservationIds = reservations.map(r => r.id)

      const { data: equipmentData, error: eqError } = await supabase
        .from('reservation_equipment')
        .select(`
          reservation_id,
          equipment:equipment_id (
            type,
            name
          )
        `)
        .in('reservation_id', reservationIds)

      if (eqError) return { data: null, error: eqError }

      // 예약별 장비 타입 그룹화
      const equipmentByReservation = {}
      equipmentData.forEach(eq => {
        if (!equipmentByReservation[eq.reservation_id]) {
          equipmentByReservation[eq.reservation_id] = []
        }
        if (eq.equipment) {
          equipmentByReservation[eq.reservation_id].push(eq.equipment.type)
        }
      })

      // 데이터 변환
      const data = reservations.map(r => ({
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
    getEquipmentStats: async (year, month) => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

      // 해당 월의 모든 예약 조회
      const { data: reservations, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)

      if (error) return { data: null, error }

      // 장비별 통계 계산
      const equipmentTypes = ['AS360', 'MICRO', 'XL', 'XXL', '알파데스크', '알파테이블', 'Compact']
      const stats = equipmentTypes.map(equipment => {
        const filtered = reservations.filter(r =>
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
    getDistrictStats: async (year, month) => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

      const { data: reservations, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)

      if (error) return { data: null, error }

      // 자치구별 그룹화
      const districtMap = {}
      reservations.forEach(r => {
        const district = r.district || '미지정'
        if (!districtMap[district]) {
          districtMap[district] = {
            district,
            total_reservations: 0,
            companies: new Set(),
            total_hours: 0,
          }
        }
        districtMap[district].total_reservations++
        districtMap[district].companies.add(r.company_id)
        districtMap[district].total_hours += 4
      })

      const stats = Object.values(districtMap)
        .map(d => ({
          ...d,
          unique_companies: d.companies.size,
        }))
        .sort((a, b) => b.total_reservations - a.total_reservations)

      return { data: stats, error: null }
    },

    // 업종별 통계
    getIndustryStats: async (year, month) => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

      const { data: reservations, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)

      if (error) return { data: null, error }

      // 업종별 그룹화
      const industryMap = {}
      reservations.forEach(r => {
        const industry = r.industry || '미지정'
        if (!industryMap[industry]) {
          industryMap[industry] = {
            industry,
            total_reservations: 0,
            companies: new Set(),
            total_hours: 0,
          }
        }
        industryMap[industry].total_reservations++
        industryMap[industry].companies.add(r.company_id)
        industryMap[industry].total_hours += 4
      })

      const stats = Object.values(industryMap)
        .map(d => ({
          ...d,
          unique_companies: d.companies.size,
        }))
        .sort((a, b) => b.total_hours - a.total_hours)
        .slice(0, 10) // 상위 10개

      return { data: stats, error: null }
    },

    // 일별 예약 추이
    getDailyTrend: async (year, month) => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

      const { data: reservations, error } = await supabase
        .from('daily_reservations')
        .select('reservation_date, time_slot')
        .gte('reservation_date', startDate)
        .lt('reservation_date', endDate)

      if (error) return { data: null, error }

      // 날짜별 그룹화
      const dateMap = {}
      reservations.forEach(r => {
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
