/**
 * 엑셀 데이터를 Supabase로 업로드하는 스크립트
 * 사용법: node scripts/upload-excel-data.js
 */

import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { format } from 'date-fns'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { normalizeCompanyName } from './company-name-mapping.js'

// .env 파일 로드
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Supabase 설정 (Service Role Key 사용 - RLS 우회)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://llrjpdmairgviunhualw.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscmpwZG1haXJndml1bmh1YWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNzcyMzgsImV4cCI6MjA4MjY1MzIzOH0.3Ec5T9n0cJrV_DBXT8oS4E9Mz9F3RiTDITRPhE6l5Ag'

const supabase = createClient(supabaseUrl, supabaseKey)

// 엑셀 파일 경로
const usageRateFile = path.join(__dirname, '..', '사용률 (2025년 1~9월).xlsx')
const facilityReserveFile = path.join(__dirname, '..', 'facilityReserve.xlsx')

console.log('📊 엑셀 데이터 통합 및 업로드 시작...\n')

// 장비 타입 매핑
const equipmentTypeMapping = {
  'XXL': 'XXL',
  'Table': '알파테이블',
  '알파테이블': '알파테이블',
  'Compact': 'Compact',
  'Micro': 'MICRO',
  'MICRO': 'MICRO',
  'Desk': '알파데스크',
  '알파데스크': '알파데스크',
  'XL': 'XL',
  'AS360': 'AS360',
  '패션스튜디오': 'Compact' // 패션스튜디오는 Compact로 매핑
}

// 엑셀의 날짜를 JavaScript Date로 변환 (시리얼 넘버)
function excelDateToJSDate(excelDate) {
  if (!excelDate) return null

  // 엑셀 날짜는 1900년 1월 1일부터의 일수
  const excelEpoch = new Date(1900, 0, 1)
  const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000)
  return format(date, 'yyyy-MM-dd')
}

// YYYYMMDD 형식을 YYYY-MM-DD로 변환
function formatDate(dateStr) {
  if (!dateStr) return null
  const str = String(dateStr)
  if (str.length === 8) {
    return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`
  }
  return null
}

// 시간 문자열을 time_slot으로 변환
function getTimeSlot(startTime, endTime) {
  if (!startTime) return 'morning'
  const start = parseInt(String(startTime).replace('시', ''))
  if (start >= 9 && start < 13) return 'morning'
  if (start >= 14 && start < 18) return 'afternoon'
  return 'morning'
}

// 장비 옵션 파싱 (슬래시, 줄바꿈, 또는 Windows 줄바꿈으로 구분된 장비 리스트)
function parseEquipmentOptions(optionsStr) {
  if (!optionsStr) return []

  // 슬래시(/), 줄바꿈(\n), Windows 줄바꿈(\r\n) 모두 지원
  return optionsStr
    .split(/\s*\/\s*|\r?\n+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => equipmentTypeMapping[t] || t)
    .filter(t => ['XXL', 'XL', 'MICRO', 'AS360', 'Compact', '알파데스크', '알파테이블'].includes(t))
}

async function uploadData() {
  try {
    // ============================================================
    // 1. facilityReserve.xlsx 읽기 (베이스 데이터)
    // ============================================================
    console.log('📅 [1/4] facilityReserve.xlsx 읽는 중...')

    if (!fs.existsSync(facilityReserveFile)) {
      console.error('❌ facilityReserve.xlsx 파일을 찾을 수 없습니다:', facilityReserveFile)
      return
    }

    const reserveWorkbook = XLSX.readFile(facilityReserveFile)
    const reserveSheet = reserveWorkbook.Sheets['Sheet1']
    const reserveData = XLSX.utils.sheet_to_json(reserveSheet)
    console.log(`✅ ${reserveData.length}건의 예약 데이터 로드 완료\n`)

    // ============================================================
    // 2. 사용률.xlsx 읽기 (상세 메트릭)
    // ============================================================
    console.log('📈 [2/4] 사용률 (2025년 1~9월).xlsx 읽는 중...')

    if (!fs.existsSync(usageRateFile)) {
      console.error('❌ 사용률 파일을 찾을 수 없습니다:', usageRateFile)
      return
    }

    const usageWorkbook = XLSX.readFile(usageRateFile)
    const usageSheet = usageWorkbook.Sheets['3층 디지털 콘텐츠 제작실']
    const usageRawData = XLSX.utils.sheet_to_json(usageSheet, { header: 1 })

    // 4행부터 실제 데이터 시작 (0-based index로 3부터)
    const usageData = usageRawData.slice(4).map(row => ({
      date: row[1], // 날짜 (엑셀 시리얼 넘버)
      companyName: row[2], // 업체명
      representative: row[3], // 대표자
      contact: row[4], // 연락처
      industry: row[5], // 업종
      district: row[6], // 지자체
      equipmentType: row[7], // 장비 종류
      photo_2d: row[8] || 0, // 2D 촬영 사진 수
      photo_3d: row[9] || 0, // 3D 촬영 사진 수
      video: row[10] || 0, // 동영상 촬영 수
      advanced: row[11] || 0, // 고도화
      training: row[12] || '', // 정기교육
      seminar: row[13] || '', // 세미나
      attendees: row[14] || 1, // 인원
      usageHours: row[15] || 4, // 가동시간
      notes: row[16] || '', // 적요
    })).filter(row => row.companyName);

    console.log(`✅ ${usageData.length}건의 사용률 데이터 로드 완료\n`)

    // ============================================================
    // 3. 기업 데이터 통합
    // ============================================================
    console.log('🏢 [3/4] 기업 데이터 통합 중...')

    const companiesMap = new Map()

    // facilityReserve에서 기업 추출
    reserveData.forEach(row => {
      const rawName = row['신청기업명']
      if (!rawName) return

      const name = normalizeCompanyName(rawName) // 기업명 정규화

      if (!companiesMap.has(name)) {
        companiesMap.set(name, {
          name: name,
          representative: '',
          contact: row['담당자명'] || '',
          company_size: row['기업규모'] === '소공인' ? '소기업' : (row['기업규모'] || '소기업'),
          industry: row['업종'] || '기타업종',
          district: '',
          business_number: null,
          email: null,
          address: null,
          notes: null
        })
      }
    })

    // 사용률 데이터로 기업 정보 보강
    usageData.forEach(row => {
      const rawName = row.companyName
      if (!rawName) return

      const name = normalizeCompanyName(rawName) // 기업명 정규화

      if (companiesMap.has(name)) {
        const company = companiesMap.get(name)
        company.representative = row.representative || company.representative
        company.contact = row.contact || company.contact
        company.industry = row.industry || company.industry
        company.district = row.district || company.district
      } else {
        companiesMap.set(name, {
          name: name,
          representative: row.representative || '',
          contact: row.contact || '',
          company_size: '소기업',
          industry: row.industry || '기타업종',
          district: row.district || '',
          business_number: null,
          email: null,
          address: null,
          notes: null
        })
      }
    })

    const companies = Array.from(companiesMap.values())
    console.log(`✅ ${companies.length}개 기업 데이터 통합 완료\n`)

    // ============================================================
    // 4. 예약 데이터 통합
    // ============================================================
    console.log('📋 [4/4] 예약 데이터 통합 중...')

    // facilityReserve 기반 예약 데이터 생성 (확정/완료 상태만)
    const reservationsData = reserveData
      .filter(row => row['예약상태'] === '확정' || row['예약상태'] === '완료')
      .map(row => {
        const date = formatDate(row['예약시작일'])
        const timeSlot = getTimeSlot(row['예약시작시간'], row['예약종료시간'])
        const equipmentTypes = parseEquipmentOptions(row['옵션'])
        const companyName = normalizeCompanyName(row['신청기업명']) // 기업명 정규화

        return {
          company_name: companyName,
          reservation_date: date,
          time_slot: timeSlot,
          status: row['예약상태'] === '완료' ? 'completed' : 'confirmed',
          equipment_types: equipmentTypes,
          // 기본값 (사용률 데이터로 보강 예정)
          photo_2d: 0,
          photo_3d: 0,
          video_count: 0,
          advanced: 0,
          attendees: 1,
          is_training: false,
          is_seminar: false,
          notes: '',
        }
      })
      .filter(r => r.reservation_date && r.company_name && r.equipment_types.length > 0)

    // 사용률 데이터로 예약 정보 보강
    usageData.forEach(usage => {
      const usageDate = excelDateToJSDate(usage.date)
      const companyName = normalizeCompanyName(usage.companyName) // 기업명 정규화
      const equipmentType = equipmentTypeMapping[usage.equipmentType] || usage.equipmentType

      // 같은 날짜 + 같은 기업으로 매칭
      const matchingReservations = reservationsData.filter(r =>
        r.reservation_date === usageDate &&
        r.company_name === companyName &&
        r.equipment_types.includes(equipmentType)
      )

      if (matchingReservations.length > 0) {
        const reservation = matchingReservations[0]
        reservation.photo_2d = (reservation.photo_2d || 0) + (usage.photo_2d || 0)
        reservation.photo_3d = (reservation.photo_3d || 0) + (usage.photo_3d || 0)
        reservation.video_count = (reservation.video_count || 0) + (usage.video || 0)
        reservation.advanced = (reservation.advanced || 0) + (usage.advanced || 0)
        reservation.attendees = Math.max(reservation.attendees, usage.attendees || 1)
        reservation.is_training = reservation.is_training || Boolean(usage.training)
        reservation.is_seminar = reservation.is_seminar || Boolean(usage.seminar)
        if (usage.notes) {
          reservation.notes = reservation.notes ? `${reservation.notes}; ${usage.notes}` : usage.notes
        }
      }
    })

    console.log(`✅ ${reservationsData.length}개 예약 데이터 통합 완료\n`)

    // ============================================================
    // 5. Supabase 업로드
    // ============================================================
    console.log('\n🚀 Supabase에 데이터 업로드 시작...\n')

    // 5-1. 기업 데이터 업로드
    console.log('📤 [1/3] 기업 데이터 업로드 중...')

    // 먼저 기존 기업 확인
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('name')

    const existingNames = new Set(existingCompanies?.map(c => c.name) || [])

    // 새로운 기업만 필터링
    const newCompanies = companies.filter(c => !existingNames.has(c.name))

    if (newCompanies.length > 0) {
      const { error: companyError } = await supabase
        .from('companies')
        .insert(newCompanies)
        .select()

      if (companyError) {
        console.error('❌ 기업 데이터 업로드 실패:', companyError)
        return
      }

      console.log(`✅ ${newCompanies.length}개 신규 기업 업로드 완료 (기존: ${existingNames.size}개)\n`)
    } else {
      console.log(`✅ 모든 기업이 이미 존재합니다 (${existingNames.size}개)\n`)
    }

    // 5-2. 기업 ID 매핑 가져오기
    const { data: allCompanies, error: fetchError } = await supabase
      .from('companies')
      .select('id, name')

    if (fetchError) {
      console.error('❌ 기업 ID 조회 실패:', fetchError)
      return
    }

    const companyIdMap = new Map(allCompanies.map(c => [c.name, c.id]))

    // 5-3. 장비 데이터 가져오기
    const { data: equipment, error: equipError } = await supabase
      .from('equipment')
      .select('id, type')

    if (equipError) {
      console.error('❌ 장비 조회 실패:', equipError)
      return
    }

    const equipmentIdMap = new Map(equipment.map(e => [e.type, e.id]))

    // 5-4. 예약 데이터 업로드 (배치 처리)
    console.log('📤 [2/3] 예약 데이터 업로드 중...')

    const batchSize = 100
    let uploadedCount = 0
    const allInsertedReservations = []

    for (let i = 0; i < reservationsData.length; i += batchSize) {
      const batch = reservationsData.slice(i, i + batchSize)

      // company_id와 equipment_types를 함께 매핑
      const batchWithCompanyId = batch.map(r => ({
        ...r,
        company_id: companyIdMap.get(r.company_name)
      })).filter(r => r.company_id)

      if (batchWithCompanyId.length === 0) continue

      const reservations = batchWithCompanyId.map(r => ({
        company_id: r.company_id,
        reservation_date: r.reservation_date,
        time_slot: r.time_slot,
        work_2d: r.photo_2d,
        work_3d: r.photo_3d,
        work_video: r.video_count,
        work_advanced: r.advanced,
        attendees: r.attendees,
        is_training: r.is_training,
        is_seminar: r.is_seminar,
        notes: r.notes,
        status: r.status
      }))

      const { data: insertedReservations, error: resError } = await supabase
        .from('reservations')
        .insert(reservations)
        .select()

      if (resError) {
        console.error('❌ 예약 데이터 업로드 실패:', resError)
        continue
      }

      // insertedReservations와 batchWithCompanyId를 매칭 (순서 보장 안 될 수 있음)
      insertedReservations.forEach(inserted => {
        const original = batchWithCompanyId.find(b =>
          b.company_id === inserted.company_id &&
          b.reservation_date === inserted.reservation_date &&
          b.time_slot === inserted.time_slot
        )
        if (original) {
          allInsertedReservations.push({
            ...inserted,
            equipment_types: original.equipment_types
          })
        } else {
          // 디버깅: 매칭 안 되는 경우
          console.log('\n⚠️ 매칭 실패:', inserted.reservation_date, inserted.time_slot)
        }
      })

      uploadedCount += reservations.length
      process.stdout.write(`\r   진행: ${uploadedCount} / ${reservationsData.length}`)
    }

    console.log('\n✅ 예약 데이터 업로드 완료\n')
    console.log(`   allInsertedReservations: ${allInsertedReservations.length}개`)

    // 디버깅: 5월 16일 데이터 확인
    const may16 = allInsertedReservations.filter(r => r.reservation_date === '2025-05-16')
    console.log(`   5월 16일 예약: ${may16.length}개`)
    may16.forEach(r => {
      console.log(`   - ${r.time_slot}: equipment_types = ${JSON.stringify(r.equipment_types)}`)
    })

    // 5-5. 예약-장비 매핑 업로드
    console.log('\n📤 [3/3] 예약-장비 매핑 데이터 업로드 중...')

    const mappings = []
    allInsertedReservations.forEach(reservation => {
      if (reservation.equipment_types && reservation.equipment_types.length > 0) {
        reservation.equipment_types.forEach(equipmentType => {
          const equipmentId = equipmentIdMap.get(equipmentType)
          if (equipmentId) {
            mappings.push({
              reservation_id: reservation.id,
              equipment_id: equipmentId,
              usage_hours: 4.0
            })
          }
        })
      }
    })

    if (mappings.length > 0) {
      // 중복 제거 (같은 reservation_id + equipment_id 조합)
      const uniqueMappings = []
      const seen = new Set()
      mappings.forEach(m => {
        const key = `${m.reservation_id}-${m.equipment_id}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueMappings.push(m)
        }
      })

      console.log(`   (중복 제거: ${mappings.length} -> ${uniqueMappings.length}개)`)

      const mappingBatchSize = 500
      let mappingUploadedCount = 0

      for (let i = 0; i < uniqueMappings.length; i += mappingBatchSize) {
        const batch = uniqueMappings.slice(i, i + mappingBatchSize)

        const { error: mapError } = await supabase
          .from('reservation_equipment')
          .insert(batch)

        if (mapError) {
          console.error('❌ 장비 매핑 실패:', mapError)
          continue
        }

        mappingUploadedCount += batch.length
        process.stdout.write(`\r   진행: ${mappingUploadedCount} / ${uniqueMappings.length}`)
      }

      console.log('\n✅ 예약-장비 매핑 업로드 완료\n')
    }

    // 결과 요약
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 데이터 업로드 완료!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 업로드 요약:`)
    console.log(`  - 기업: ${companies.length}개 (신규: ${newCompanies.length}개)`)
    console.log(`  - 예약: ${uploadedCount}개`)
    console.log(`  - 예약-장비 매핑: ${mappings.length}개`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n✅ 브라우저에서 http://localhost:3000 으로 확인하세요!\n')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  }
}

// 실행
uploadData()
