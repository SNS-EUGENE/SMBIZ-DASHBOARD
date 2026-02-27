// Supabase DB upsert 로직
// 원본: scripts/scrape-smbiz.js의 upsertCompany, upsertReservation, linkEquipment 포팅

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  EQUIPMENT_CODE_MAP,
  EQUIPMENT_NAME_MAP,
  formatDate,
  formatTimeForDB,
  deriveTimeSlot,
  mapStatus,
  mapCompanySize,
  mapIndustry,
} from './mappings.ts'
import type { DetailData, EquipmentItem } from './html-parser.ts'

/** 장비 ID 캐시 (Edge Function 라이프사이클 내) */
const equipmentIdCache: Record<string, string> = {}

async function getEquipmentId(supabase: SupabaseClient, type: string): Promise<string | null> {
  if (equipmentIdCache[type]) return equipmentIdCache[type]

  const { data } = await supabase
    .from('equipment')
    .select('id')
    .eq('type', type)
    .limit(1)
    .maybeSingle()

  if (data) {
    equipmentIdCache[type] = data.id
    return data.id
  }
  return null
}

/** 기업 upsert — business_number 기준 dedup */
export async function upsertCompany(
  supabase: SupabaseClient,
  detail: DetailData
): Promise<string | null> {
  const businessNumber = detail.business_number?.trim()

  if (businessNumber) {
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('business_number', businessNumber)
      .maybeSingle()

    if (existing) return existing.id
  }

  const insertData = {
    name: detail.company_name?.trim() || '(미상)',
    representative: detail.representative?.trim() || '',
    business_number: businessNumber || null,
    company_size: mapCompanySize(detail.company_size_code),
    industry: mapIndustry(detail.industry_code),
    contact: detail.contact?.trim() || '',
  }

  const { data: created, error } = await supabase
    .from('companies')
    .insert(insertData)
    .select('id')
    .single()

  if (error) {
    // UNIQUE violation → 이미 존재 (race condition)
    if (error.code === '23505' && businessNumber) {
      const { data: found } = await supabase
        .from('companies')
        .select('id')
        .eq('business_number', businessNumber)
        .single()
      return found?.id || null
    }
    console.error(`기업 생성 실패 (${insertData.name}): ${error.message}`)
    return null
  }

  return created.id
}

/** 예약 upsert — reserve_idx 기준 */
export async function upsertReservation(
  supabase: SupabaseClient,
  companyId: string,
  reserveIdx: string,
  detail: DetailData
): Promise<string | null> {
  const startDate = formatDate(detail.start_date)
  const endDate = formatDate(detail.end_date)

  if (!startDate) {
    console.error(`날짜 파싱 실패 (reserve_idx=${reserveIdx}): start_date=${detail.start_date}`)
    return null
  }

  const insertData = {
    reserve_idx: reserveIdx,
    company_id: companyId,
    reservation_date: startDate,
    end_date: endDate,
    time_slot: deriveTimeSlot(detail.start_time),
    start_time: formatTimeForDB(detail.start_time),
    end_time: formatTimeForDB(detail.end_time),
    status: mapStatus(detail.status_code),
    request_notes: detail.request_notes || null,
    // 기본값 (smbiz에서 제공하지 않는 필드)
    work_2d: 0,
    work_3d: 0,
    work_video: 0,
    work_advanced: 0,
    attendees: 1,
    is_training: false,
    is_seminar: false,
  }

  const { data: reservation, error } = await supabase
    .from('reservations')
    .upsert(insertData, { onConflict: 'reserve_idx' })
    .select('id')
    .single()

  if (error) {
    console.error(`예약 upsert 실패 (${reserveIdx}): ${error.message}`)
    return null
  }

  return reservation.id
}

/** 장비 매핑 — 기존 삭제 후 재삽입 */
export async function linkEquipment(
  supabase: SupabaseClient,
  reservationId: string,
  equipmentItems: EquipmentItem[]
): Promise<void> {
  if (!reservationId || !equipmentItems?.length) return

  // 기존 매핑 삭제
  await supabase
    .from('reservation_equipment')
    .delete()
    .eq('reservation_id', reservationId)

  for (const item of equipmentItems) {
    // 1차: opt_code → 장비타입 매핑
    let type = EQUIPMENT_CODE_MAP[item.code]

    // 2차: label 텍스트로 fallback
    if (!type && item.label) {
      type = EQUIPMENT_NAME_MAP[item.label]
    }

    if (!type) {
      console.error(`알 수 없는 장비: code="${item.code}" label="${item.label}"`)
      continue
    }

    const equipmentId = await getEquipmentId(supabase, type)
    if (!equipmentId) {
      console.error(`장비 ID 없음: type="${type}"`)
      continue
    }

    const { error } = await supabase
      .from('reservation_equipment')
      .insert({
        reservation_id: reservationId,
        equipment_id: equipmentId,
      })

    if (error && error.code !== '23505') {
      console.error(`장비 매핑 실패 (${reservationId} → ${type}): ${error.message}`)
    }
  }
}

export interface ExistingReservation {
  reservationId: string
  status: string
}

/** DB에서 기존 reserve_idx → { reservationId, status } Map 로드 */
export async function getExistingReserveIdxMap(
  supabase: SupabaseClient
): Promise<Map<string, ExistingReservation>> {
  const map = new Map<string, ExistingReservation>()
  const { data, error } = await supabase
    .from('reservations')
    .select('id, reserve_idx, status')
    .not('reserve_idx', 'is', null)

  if (error) {
    console.error(`기존 reserve_idx 로드 실패: ${error.message}`)
    return map
  }

  for (const row of data || []) {
    if (row.reserve_idx) {
      map.set(row.reserve_idx, { reservationId: row.id, status: row.status })
    }
  }

  return map
}

/** 예약 상태만 업데이트 */
export async function updateReservationStatus(
  supabase: SupabaseClient,
  reservationId: string,
  newStatus: string
): Promise<boolean> {
  const { error } = await supabase
    .from('reservations')
    .update({ status: newStatus })
    .eq('id', reservationId)

  if (error) {
    console.error(`상태 업데이트 실패 (${reservationId}): ${error.message}`)
    return false
  }
  return true
}

/** sync_log 생성 */
export async function createSyncLog(
  supabase: SupabaseClient,
  mode: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sync_log')
    .insert({ mode, status: 'running' })
    .select('id')
    .single()

  if (error) {
    console.error(`sync_log 생성 실패: ${error.message}`)
    return null
  }
  return data.id
}

/** sync_log 완료 업데이트 */
export async function completeSyncLog(
  supabase: SupabaseClient,
  logId: string,
  result: { new_count: number; error_count: number; details: unknown; status: string }
): Promise<void> {
  await supabase
    .from('sync_log')
    .update({
      completed_at: new Date().toISOString(),
      new_count: result.new_count,
      error_count: result.error_count,
      details: result.details,
      status: result.status,
    })
    .eq('id', logId)
}
