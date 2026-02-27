// 카카오워크 Bot API를 통한 알림 발송
// API: https://api.kakaowork.com/v1/messages.send_by_email

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const KAKAOWORK_API = 'https://api.kakaowork.com/v1'

const STATUS_LABEL: Record<string, string> = {
  pending: '신청',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
}

export interface NotificationItem {
  type: 'new' | 'status_changed'
  companyName: string
  applicantName: string
  reservationDate: string
  timeSlot: string
  contact: string
  equipment: string[]
  oldStatus?: string
  newStatus?: string
}

/**
 * 동기화 완료 후 카카오워크 알림 발송 (건별 개별 발송)
 */
export async function sendKakaoWorkNotifications(
  supabase: SupabaseClient,
  notifications: NotificationItem[]
): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 }

  if (notifications.length === 0) return result

  const botKey = Deno.env.get('KAKAOWORK_BOT_KEY')
  if (!botKey) {
    console.log('[KakaoWork] KAKAOWORK_BOT_KEY 미설정 → 알림 스킵')
    return result
  }

  // DB에서 수신자 이메일 목록 조회
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'kakaowork_recipients')
    .single()

  const emails = (data?.value as { emails?: string[] })?.emails
  if (!emails || emails.length === 0) {
    console.log('[KakaoWork] 수신자 미설정 → 알림 스킵')
    return result
  }

  console.log(`[KakaoWork] ${emails.length}명에게 ${notifications.length}건 알림 발송`)

  // 건별로 메시지 생성 → 각 수신자에게 전송
  for (const item of notifications) {
    const message = buildMessage(item)

    const sendResults = await Promise.allSettled(
      emails.map(email => sendMessage(botKey, email, message))
    )

    sendResults.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        result.sent++
      } else {
        result.failed++
        console.error(`[KakaoWork] ${emails[i]} 전송 실패:`, r.reason)
      }
    })
  }

  console.log(`[KakaoWork] 완료: ${result.sent}건 성공, ${result.failed}건 실패`)
  return result
}

function buildMessage(item: NotificationItem): string {
  if (item.type === 'new') {
    return buildNewMessage(item)
  }
  // status_changed
  if (item.newStatus === 'cancelled') {
    return buildCancelledMessage(item)
  }
  return buildStatusChangedMessage(item)
}

function buildNewMessage(item: NotificationItem): string {
  const ts = item.timeSlot === 'morning' ? '오전' : '오후'
  const lines = [`신규 예약 건이 있습니다.`, '']

  lines.push(`📆 ${item.reservationDate} ${ts}`)
  if (item.equipment.length > 0) {
    lines.push(`🔧 ${item.equipment.join(', ')}`)
  }
  lines.push(`🏢 ${item.companyName}`)
  if (item.applicantName) {
    lines.push(`👤 ${item.applicantName}`)
  }
  if (item.contact) {
    lines.push(`📞 ${item.contact}`)
  }

  return lines.join('\n')
}

function buildCancelledMessage(item: NotificationItem): string {
  const ts = item.timeSlot === 'morning' ? '오전' : '오후'
  const lines = [`예약이 취소되었습니다.`, '']

  lines.push(`📆 ${item.reservationDate} ${ts}`)
  if (item.equipment.length > 0) {
    lines.push(`🔧 ${item.equipment.join(', ')}`)
  }
  lines.push(`🏢 ${item.companyName}`)

  return lines.join('\n')
}

function buildStatusChangedMessage(item: NotificationItem): string {
  const ts = item.timeSlot === 'morning' ? '오전' : '오후'
  const oldLabel = STATUS_LABEL[item.oldStatus || ''] || item.oldStatus || ''
  const newLabel = STATUS_LABEL[item.newStatus || ''] || item.newStatus || ''
  const lines = [`예약 상태가 변경되었습니다.`, '']

  lines.push(`📆 ${item.reservationDate} ${ts}`)
  lines.push(`🏢 ${item.companyName}`)
  lines.push(`🔄 ${oldLabel} → ${newLabel}`)

  return lines.join('\n')
}

async function sendMessage(botKey: string, email: string, text: string): Promise<void> {
  const response = await fetch(`${KAKAOWORK_API}/messages.send_by_email`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, text }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${body}`)
  }
}
