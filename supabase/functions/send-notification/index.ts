// Supabase Edge Function: send-notification
// 프론트엔드에서 호출하여 카카오워크 알림 발송
//
// POST /functions/v1/send-notification
// Body: { text: string }
// Headers: Authorization: Bearer <SUPABASE_ANON_KEY>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const KAKAOWORK_API = 'https://api.kakaowork.com/v1'

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
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { text } = await req.json().catch(() => ({ text: '' }))

    if (!text || typeof text !== 'string') {
      return jsonResponse({ error: 'text 필드가 필요합니다.' }, 400)
    }

    const botKey = Deno.env.get('KAKAOWORK_BOT_KEY')
    if (!botKey) {
      console.log('[send-notification] KAKAOWORK_BOT_KEY 미설정')
      return jsonResponse({ success: true, sent: 0, skipped: true, reason: 'bot_key_not_set' })
    }

    // Supabase 클라이언트 (수신자 조회용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 수신자 이메일 목록 조회
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'kakaowork_recipients')
      .single()

    const emails = (data?.value as { emails?: string[] })?.emails
    if (!emails || emails.length === 0) {
      console.log('[send-notification] 수신자 미설정')
      return jsonResponse({ success: true, sent: 0, skipped: true, reason: 'no_recipients' })
    }

    // 각 수신자에게 전송
    let sent = 0
    let failed = 0

    const results = await Promise.allSettled(
      emails.map(async (email) => {
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
      })
    )

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        sent++
      } else {
        failed++
        console.error(`[send-notification] ${emails[i]} 실패:`, r.reason)
      }
    })

    return jsonResponse({ success: true, sent, failed })
  } catch (err) {
    console.error('[send-notification] 에러:', err)
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, 500)
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
