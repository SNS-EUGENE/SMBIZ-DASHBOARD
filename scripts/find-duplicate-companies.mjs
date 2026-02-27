/**
 * 사업자번호 기준 중복 기업 찾기
 * 하이픈 제거 후 10자리로 정규화 → 같은 번호끼리 그룹 → 중복 출력
 *
 * Usage: node scripts/find-duplicate-companies.mjs
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function main() {
  // 1) 전체 기업 조회
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, representative, business_number, industry, contact, district, company_size')
    .not('business_number', 'is', null)
    .order('name')

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  // 2) 각 기업의 예약 수 조회
  const { data: reservations } = await supabase
    .from('reservations')
    .select('company_id')

  const reservationCounts = new Map()
  if (reservations) {
    for (const r of reservations) {
      reservationCounts.set(r.company_id, (reservationCounts.get(r.company_id) || 0) + 1)
    }
  }

  // 3) 사업자번호 정규화 후 그룹핑
  const groups = new Map()

  for (const c of companies) {
    const raw = c.business_number || ''
    const clean = raw.replace(/-/g, '').trim()
    if (!clean) continue

    if (!groups.has(clean)) {
      groups.set(clean, [])
    }
    groups.get(clean).push({
      ...c,
      biz_clean: clean,
      reservation_count: reservationCounts.get(c.id) || 0,
    })
  }

  // 4) 중복만 필터 (2개 이상인 그룹)
  const duplicates = [...groups.entries()]
    .filter(([, entries]) => entries.length > 1)
    .sort((a, b) => b[1].length - a[1].length) // 많은 순

  if (duplicates.length === 0) {
    console.log('중복 기업이 없습니다.')
    return
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`  중복 사업자번호 그룹: ${duplicates.length}개`)
  console.log(`  (총 ${duplicates.reduce((s, [, e]) => s + e.length, 0)}개 기업 레코드)`)
  console.log(`${'='.repeat(80)}\n`)

  for (const [bizNum, entries] of duplicates) {
    const formatted = bizNum.length === 10
      ? `${bizNum.slice(0, 3)}-${bizNum.slice(3, 5)}-${bizNum.slice(5)}`
      : bizNum

    console.log(`━━━ 사업자번호: ${formatted} (${bizNum}) — ${entries.length}개 레코드 ━━━`)
    for (const e of entries) {
      console.log(`  ID: ${e.id}`)
      console.log(`    회사명: ${e.name}`)
      console.log(`    대표자: ${e.representative}`)
      console.log(`    업종: ${e.industry || '-'}`)
      console.log(`    연락처: ${e.contact || '-'}`)
      console.log(`    지역구: ${e.district || '-'}`)
      console.log(`    기업규모: ${e.company_size || '-'}`)
      console.log(`    원본 사업자번호: ${e.business_number}`)
      console.log(`    예약 수: ${e.reservation_count}건`)
      console.log()
    }
    console.log()
  }

  // 5) 요약 테이블
  console.log(`\n${'='.repeat(80)}`)
  console.log('  요약: 통일 필요 기업 목록')
  console.log(`${'='.repeat(80)}\n`)
  console.log(`${'사업자번호'.padEnd(15)} | ${'회사명들'.padEnd(40)} | 대표자들`)
  console.log(`${'-'.repeat(15)} | ${'-'.repeat(40)} | ${'-'.repeat(30)}`)

  for (const [bizNum, entries] of duplicates) {
    const formatted = bizNum.length === 10
      ? `${bizNum.slice(0, 3)}-${bizNum.slice(3, 5)}-${bizNum.slice(5)}`
      : bizNum
    const names = [...new Set(entries.map(e => e.name))].join(' / ')
    const reps = [...new Set(entries.map(e => e.representative))].join(' / ')
    console.log(`${formatted.padEnd(15)} | ${names.padEnd(40)} | ${reps}`)
  }
}

main().catch(console.error)
