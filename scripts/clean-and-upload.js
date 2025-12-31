/**
 * Supabase 데이터를 완전히 삭제하고 새로 업로드하는 스크립트
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🗑️  Supabase 데이터베이스 초기화 중...\n')

async function cleanDatabase() {
  try {
    // 1. 예약-장비 매핑 삭제
    console.log('📤 [1/4] 예약-장비 매핑 삭제 중...')
    const { error: mappingError } = await supabase
      .from('reservation_equipment')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (mappingError && mappingError.code !== 'PGRST116') {
      console.error('❌ 예약-장비 매핑 삭제 실패:', mappingError)
    } else {
      console.log('✅ 예약-장비 매핑 삭제 완료\n')
    }

    // 2. 예약 삭제
    console.log('📤 [2/4] 예약 데이터 삭제 중...')
    const { error: reservationError } = await supabase
      .from('reservations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (reservationError && reservationError.code !== 'PGRST116') {
      console.error('❌ 예약 삭제 실패:', reservationError)
    } else {
      console.log('✅ 예약 데이터 삭제 완료\n')
    }

    // 3. 기업 삭제
    console.log('📤 [3/4] 기업 데이터 삭제 중...')
    const { error: companyError } = await supabase
      .from('companies')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (companyError && companyError.code !== 'PGRST116') {
      console.error('❌ 기업 삭제 실패:', companyError)
    } else {
      console.log('✅ 기업 데이터 삭제 완료\n')
    }

    // 4. 장비 삭제 (선택적 - 기본 장비는 유지)
    console.log('📤 [4/4] 장비 데이터 확인 중...')
    const { data: equipment } = await supabase
      .from('equipment')
      .select('*')

    if (equipment && equipment.length > 0) {
      console.log(`✅ 장비 데이터 유지: ${equipment.length}개\n`)
    } else {
      console.log('⚠️  장비 데이터가 없습니다. database-schema.sql을 실행하세요.\n')
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 데이터베이스 초기화 완료!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n이제 npm run upload-data 를 실행하세요.\n')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  }
}

cleanDatabase()
