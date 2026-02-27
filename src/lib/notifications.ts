// 카카오워크 알림 발송 헬퍼
// Edge Function (send-notification)을 통해 메시지 전송
// 실패해도 UI에 영향 없이 무시 (fire-and-forget)

import { supabase } from './supabase'

/** Edge Function 호출 (fire-and-forget) */
function sendNotification(text: string): void {
  console.log('[notification] 알림 발송 시도:', text.substring(0, 30) + '...')
  supabase.functions.invoke('send-notification', {
    body: { text },
  }).then(({ data, error }) => {
    if (error) {
      console.error('[notification] Edge Function 에러:', error)
    } else {
      console.log('[notification] 발송 결과:', data)
    }
  }).catch((err) => {
    console.error('[notification] 네트워크 에러:', err)
  })
}

// ── 예약 관련 ────────────────────────────────

interface ReservationNotifyData {
  date: string           // YYYY-MM-DD
  timeSlot: string       // 'morning' | 'afternoon'
  equipment: string[]    // ['AS360', 'MICRO']
  companyName: string
  applicantName?: string // 대표자/담당자
  contact?: string       // 전화번호
}

const fmtTimeSlot = (ts: string) => ts === 'morning' ? '오전' : '오후'

export function notifyReservationCreated(data: ReservationNotifyData): void {
  const lines = ['신규 예약 건이 있습니다.', '']
  lines.push(`📆 ${data.date} ${fmtTimeSlot(data.timeSlot)}`)
  if (data.equipment.length > 0) lines.push(`🔧 ${data.equipment.join(', ')}`)
  lines.push(`🏢 ${data.companyName}`)
  if (data.applicantName) lines.push(`👤 ${data.applicantName}`)
  if (data.contact) lines.push(`📞 ${data.contact}`)
  sendNotification(lines.join('\n'))
}

export function notifyReservationUpdated(data: ReservationNotifyData): void {
  const lines = ['예약이 수정되었습니다.', '']
  lines.push(`📆 ${data.date} ${fmtTimeSlot(data.timeSlot)}`)
  if (data.equipment.length > 0) lines.push(`🔧 ${data.equipment.join(', ')}`)
  lines.push(`🏢 ${data.companyName}`)
  if (data.applicantName) lines.push(`👤 ${data.applicantName}`)
  if (data.contact) lines.push(`📞 ${data.contact}`)
  sendNotification(lines.join('\n'))
}

export function notifyReservationCancelled(data: Pick<ReservationNotifyData, 'date' | 'timeSlot' | 'equipment' | 'companyName'>): void {
  const lines = ['예약이 취소되었습니다.', '']
  lines.push(`📆 ${data.date} ${fmtTimeSlot(data.timeSlot)}`)
  if (data.equipment.length > 0) lines.push(`🔧 ${data.equipment.join(', ')}`)
  lines.push(`🏢 ${data.companyName}`)
  sendNotification(lines.join('\n'))
}

// ── 만족도 조사 ────────────────────────────────

interface SurveyNotifyData {
  date: string
  timeSlot: string
  equipment: string[]
  companyName: string
  averageRating: number  // 1~5
}

export function notifySurveyCompleted(data: SurveyNotifyData): void {
  const lines = ['만족도조사가 완료되었습니다.', '']
  lines.push(`📆 ${data.date} ${fmtTimeSlot(data.timeSlot)}`)
  if (data.equipment.length > 0) lines.push(`🔧 ${data.equipment.join(', ')}`)
  lines.push(`🏢 ${data.companyName}`)
  lines.push(`⭐ ${data.averageRating.toFixed(1)} (평균)`)
  sendNotification(lines.join('\n'))
}

// ── 시설 점검 ────────────────────────────────

interface FacilityInspectionNotifyData {
  date: string           // YYYY-MM-DD
  issues: string | null  // 고장/수리 사항 (없으면 null)
  inspector: string
}

export function notifyFacilityInspection(data: FacilityInspectionNotifyData): void {
  const lines = ['시설 점검이 완료되었습니다.', '']
  lines.push(`📆 ${data.date}`)
  lines.push(`⛔ 고장 및 수리 사항 : ${data.issues?.trim() || '-'}`)
  lines.push(`👨‍💼 확인자 : ${data.inspector || '-'}`)
  sendNotification(lines.join('\n'))
}

// ── 장비 점검 ────────────────────────────────

interface EquipmentInspectionNotifyData {
  weekLabel: string      // e.g. "2026년 2월 1주차 (2/2~2/6)"
  issues: string | null
  inspector: string
}

export function notifyEquipmentInspection(data: EquipmentInspectionNotifyData): void {
  const lines = ['장비 점검이 완료되었습니다.', '']
  lines.push(`📆 ${data.weekLabel}`)
  lines.push(`⛔ 고장 및 수리 사항 : ${data.issues?.trim() || '-'}`)
  lines.push(`👨‍💼 확인자 : ${data.inspector || '-'}`)
  sendNotification(lines.join('\n'))
}
