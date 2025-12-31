/**
 * 예약 데이터 분석 스크립트
 * equipment_types가 null인 예약 분석
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function analyzeData() {
  console.log('📊 예약 데이터 분석 시작...\n')

  // 1. 전체 예약 수 (reservations 테이블)
  const { count: totalReservations } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })

  console.log(`📋 전체 예약 수 (reservations 테이블): ${totalReservations}건`)

  // 2. 장비 매핑이 있는 예약 수
  const { data: mappedReservations } = await supabase
    .from('reservation_equipment')
    .select('reservation_id')

  const uniqueMappedIds = new Set(mappedReservations?.map(r => r.reservation_id) || [])
  console.log(`🔗 장비 매핑이 있는 예약: ${uniqueMappedIds.size}건`)
  console.log(`❌ 장비 매핑이 없는 예약: ${totalReservations - uniqueMappedIds.size}건\n`)

  // 3. daily_reservations 뷰에서 equipment_types가 [null]인 것 확인
  const { data: dailyData } = await supabase
    .from('daily_reservations')
    .select('*')
    .order('reservation_date', { ascending: false })
    .limit(100)

  const nullEquipmentReservations = dailyData?.filter(r =>
    !r.equipment_types ||
    r.equipment_types.length === 0 ||
    (r.equipment_types.length === 1 && r.equipment_types[0] === null)
  ) || []

  console.log(`🔍 daily_reservations 뷰에서 equipment_types가 [null]인 예약:`)
  console.log(`   총 ${nullEquipmentReservations.length}건\n`)

  if (nullEquipmentReservations.length > 0) {
    console.log('📝 상세 목록 (최대 20건):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    nullEquipmentReservations.slice(0, 20).forEach((r, i) => {
      console.log(`${i + 1}. ${r.reservation_date} | ${r.time_slot} | ${r.company_name}`)
      console.log(`   equipment_types: ${JSON.stringify(r.equipment_types)}`)
      console.log('')
    })
  }

  // 4. 특정 날짜로 확인 (예: 문제 있던 날짜)
  const testDates = ['2025-04-09', '2025-05-22']

  for (const testDate of testDates) {
    console.log(`\n📅 ${testDate} 날짜 상세 분석:`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const { data: dateData } = await supabase
      .from('daily_reservations')
      .select('*')
      .eq('reservation_date', testDate)

    if (dateData && dateData.length > 0) {
      console.log(`총 예약: ${dateData.length}건`)

      dateData.forEach((r, i) => {
        const hasValidEquipment = r.equipment_types &&
          r.equipment_types.length > 0 &&
          r.equipment_types[0] !== null

        console.log(`${i + 1}. ${r.company_name} (${r.time_slot})`)
        console.log(`   equipment_types: ${JSON.stringify(r.equipment_types)}`)
        console.log(`   타임라인 표시: ${hasValidEquipment ? '✅ 가능' : '❌ 불가능'}`)
      })
    } else {
      console.log('해당 날짜에 예약이 없습니다.')
    }
  }

  // 5. reservation_equipment 테이블에 없는 reservation_id 찾기
  console.log('\n\n📊 reservation_equipment에 매핑이 없는 예약 상세:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const { data: allReservations } = await supabase
    .from('reservations')
    .select(`
      id,
      reservation_date,
      time_slot,
      status,
      company_id,
      companies (name)
    `)
    .order('reservation_date', { ascending: false })
    .limit(500)

  const unmappedReservations = allReservations?.filter(r => !uniqueMappedIds.has(r.id)) || []

  console.log(`총 ${unmappedReservations.length}건의 매핑 없는 예약:\n`)

  unmappedReservations.slice(0, 30).forEach((r, i) => {
    console.log(`${i + 1}. ${r.reservation_date} | ${r.time_slot} | ${r.companies?.name || '회사명 없음'} | ${r.status}`)
  })

  if (unmappedReservations.length > 30) {
    console.log(`\n... 외 ${unmappedReservations.length - 30}건 더 있음`)
  }

  console.log('\n\n✅ 분석 완료!')
}

analyzeData().catch(console.error)
