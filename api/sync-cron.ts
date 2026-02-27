// Vercel Serverless Function: /api/sync-cron
// Vercel Cron이 1시간마다 호출 → Supabase Edge Function(sync-reservations) 실행
//
// 환경변수 (Vercel Dashboard에 설정):
//   CRON_SECRET          - Cron 엔드포인트 보호용
//   SUPABASE_URL         - Supabase 프로젝트 URL (VITE_ 접두사 없이)
//   SUPABASE_ANON_KEY    - Supabase anon key (VITE_ 접두사 없이)

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron은 GET으로 호출하며, Authorization 헤더에 CRON_SECRET을 넣어줌
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' })
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ mode: 'incremental' }),
    })

    const data = await response.json()

    // TODO: 카카오워크 알림 연동 시 여기에 추가
    // if (data.newCount > 0 || data.updatedCount > 0) {
    //   await sendKakaoWorkNotification(data)
    // }

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      sync: data,
    })
  } catch (err) {
    console.error('Cron sync error:', err)
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
