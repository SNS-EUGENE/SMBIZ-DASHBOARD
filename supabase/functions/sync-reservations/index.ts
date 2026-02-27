// Supabase Edge Function: sync-reservations
// smbiz.sba.kr에서 신규 예약 건을 동기화
//
// POST /functions/v1/sync-reservations
// Body: { mode: "incremental" | "full" }
// Headers: Authorization: Bearer <SUPABASE_ANON_KEY>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { login, initListPage, getListPageHtml, getDetailPageHtml } from './smbiz-client.ts'
import { parseListPageFiltered, parseTotalPages, parseDetailPage } from './html-parser.ts'
import {
  upsertCompany,
  upsertReservation,
  linkEquipment,
  getExistingReserveIdxMap,
  updateReservationStatus,
  createSyncLog,
  completeSyncLog,
} from './db.ts'
import { mapStatus, formatDate, deriveTimeSlot, EQUIPMENT_CODE_MAP, EQUIPMENT_NAME_MAP } from './mappings.ts'
import { sendKakaoWorkNotifications, type NotificationItem } from './kakaowork.ts'

const FACILITY_FILTER = '디지털콘텐츠 제작실(3F)'
const DELAY_DETAIL_MS = 300
const DELAY_LIST_MS = 500

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface SyncResult {
  success: boolean
  newCount: number
  updatedCount: number
  errorCount: number
  details: string[]
  notifications: NotificationItem[]
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, x-application-name',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { mode = 'incremental' } = await req.json().catch(() => ({}))

    // Supabase 클라이언트 (SERVICE_ROLE_KEY로 RLS 바이패스)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // smbiz 자격증명
    const smbizId = Deno.env.get('SMBIZ_ADMIN_ID')
    const smbizPw = Deno.env.get('SMBIZ_ADMIN_PW')

    if (!smbizId || !smbizPw) {
      return jsonResponse({
        success: false,
        error: 'SMBIZ_ADMIN_ID / SMBIZ_ADMIN_PW 시크릿이 설정되지 않았습니다.',
      }, 500)
    }

    // sync_log 생성
    const logId = await createSyncLog(supabase, mode)

    const result = await runSync(supabase, smbizId, smbizPw, mode)

    // sync_log 완료
    if (logId) {
      await completeSyncLog(supabase, logId, {
        new_count: result.newCount,
        error_count: result.errorCount,
        details: result.details,
        status: result.success ? 'completed' : 'failed',
      })
    }

    // 카카오워크 알림 발송 (신규/변경 건이 있을 때만)
    if (result.notifications.length > 0) {
      try {
        const notifyResult = await sendKakaoWorkNotifications(supabase, result.notifications)
        result.details.push(`카카오워크: ${notifyResult.sent}건 발송, ${notifyResult.failed}건 실패`)
      } catch (err) {
        console.error('[KakaoWork] 알림 발송 에러:', err)
        result.details.push(`카카오워크 알림 에러: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return jsonResponse(result)
  } catch (err) {
    console.error('동기화 에러:', err)
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, 500)
  }
})

async function runSync(
  supabase: ReturnType<typeof createClient>,
  smbizId: string,
  smbizPw: string,
  mode: string
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    newCount: 0,
    updatedCount: 0,
    errorCount: 0,
    details: [],
    notifications: [],
  }

  // 1) DB에서 기존 reserve_idx Map 로드 (reserve_idx → { reservationId, status })
  const existingMap = await getExistingReserveIdxMap(supabase)
  result.details.push(`기존 예약 ${existingMap.size}건 로드됨`)

  // 2) smbiz 로그인
  let sessionCookie: string
  try {
    sessionCookie = await login(smbizId, smbizPw)
    result.details.push('smbiz 로그인 성공')
  } catch (err) {
    result.success = false
    result.details.push(`로그인 실패: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  // 3) 목록 페이지 초기 로드 (GET → hidden fields 추출)
  const { html: firstPageHtml, hiddenFields } = await initListPage(sessionCookie)
  const totalPages = parseTotalPages(firstPageHtml)
  result.details.push(`목록 총 ${totalPages} 페이지`)

  // 4) 목록 페이지 순회 (최신→과거)
  const newReserveIdxs: string[] = []
  const checkStatusIdxs: string[] = []  // 상태 변경 확인 대상
  let stopPaging = false

  for (let pageIdx = 1; pageIdx <= totalPages; pageIdx++) {
    if (stopPaging) break

    const html = pageIdx === 1 ? firstPageHtml : await getListPageHtml(sessionCookie, pageIdx, hiddenFields)
    const idsOnPage = parseListPageFiltered(html, FACILITY_FILTER)

    if (idsOnPage.length === 0) {
      continue
    }

    let allExist = true
    for (const idx of idsOnPage) {
      if (!existingMap.has(idx)) {
        newReserveIdxs.push(idx)
        allExist = false
      } else {
        checkStatusIdxs.push(idx)
      }
    }

    // incremental 모드: 한 페이지의 모든 reserve_idx가 이미 DB에 있으면 중단
    if (mode === 'incremental' && allExist) {
      result.details.push(`페이지 ${pageIdx}: 모든 건이 이미 존재 → 페이징 중단`)
      stopPaging = true
    }

    if (pageIdx < totalPages && !stopPaging) {
      await delay(DELAY_LIST_MS)
    }
  }

  result.details.push(`신규 ${newReserveIdxs.length}건, 상태확인 ${checkStatusIdxs.length}건`)

  // 5) 신규 reserve_idx에 대해 상세 파싱 → DB 저장
  for (const reserveIdx of newReserveIdxs) {
    try {
      const detailHtml = await getDetailPageHtml(sessionCookie, reserveIdx)
      const detail = parseDetailPage(detailHtml)

      // 기업 upsert
      const companyId = await upsertCompany(supabase, detail)
      if (!companyId) {
        result.errorCount++
        result.details.push(`${reserveIdx}: 기업 생성 실패`)
        continue
      }

      // 예약 upsert
      const reservationId = await upsertReservation(supabase, companyId, reserveIdx, detail)
      if (!reservationId) {
        result.errorCount++
        result.details.push(`${reserveIdx}: 예약 생성 실패`)
        continue
      }

      // 장비 매핑
      await linkEquipment(supabase, reservationId, detail.equipment)

      result.newCount++

      // 알림 데이터 수집
      const equipmentNames = detail.equipment.map(eq =>
        EQUIPMENT_CODE_MAP[eq.code] || EQUIPMENT_NAME_MAP[eq.label] || eq.label
      ).filter(Boolean)

      result.notifications.push({
        type: 'new',
        companyName: detail.company_name?.trim() || '(미상)',
        applicantName: detail.representative?.trim() || '',
        reservationDate: formatDate(detail.start_date) || detail.start_date,
        timeSlot: deriveTimeSlot(detail.start_time),
        contact: detail.contact?.trim() || '',
        equipment: equipmentNames,
      })

      await delay(DELAY_DETAIL_MS)
    } catch (err) {
      result.errorCount++
      result.details.push(`${reserveIdx}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 6) 기존 예약 상태 변경 확인
  for (const reserveIdx of checkStatusIdxs) {
    try {
      const existing = existingMap.get(reserveIdx)!
      const detailHtml = await getDetailPageHtml(sessionCookie, reserveIdx)
      const detail = parseDetailPage(detailHtml)
      const newStatus = mapStatus(detail.status_code)

      if (newStatus !== existing.status) {
        const ok = await updateReservationStatus(supabase, existing.reservationId, newStatus)
        if (ok) {
          result.updatedCount++
          result.details.push(`${reserveIdx}: ${existing.status} → ${newStatus}`)

          // 알림 데이터 수집
          const changedEquipNames = detail.equipment.map(eq =>
            EQUIPMENT_CODE_MAP[eq.code] || EQUIPMENT_NAME_MAP[eq.label] || eq.label
          ).filter(Boolean)

          result.notifications.push({
            type: 'status_changed',
            companyName: detail.company_name?.trim() || reserveIdx,
            applicantName: detail.representative?.trim() || '',
            reservationDate: formatDate(detail.start_date) || '',
            timeSlot: deriveTimeSlot(detail.start_time),
            contact: detail.contact?.trim() || '',
            equipment: changedEquipNames,
            oldStatus: existing.status,
            newStatus,
          })
        }
      }

      await delay(DELAY_DETAIL_MS)
    } catch (err) {
      result.errorCount++
      result.details.push(`${reserveIdx} 상태확인: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  result.details.push(`완료: 신규 ${result.newCount}건, 상태변경 ${result.updatedCount}건, 에러 ${result.errorCount}건`)
  return result
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
