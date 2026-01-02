/**
 * 업로드 디버깅 스크립트
 */

import XLSX from 'xlsx'
import { format } from 'date-fns'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { normalizeCompanyName } from './company-name-mapping.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const facilityReserveFile = path.join(__dirname, '..', 'facilityReserve.xlsx')

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
  '패션스튜디오': 'Compact'
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

// 메인
const workbook = XLSX.readFile(facilityReserveFile)
const sheet = workbook.Sheets['Sheet1']
const reserveData = XLSX.utils.sheet_to_json(sheet)

console.log('=== 5월 16일 데이터 디버깅 ===\n')

const may16 = reserveData.filter(row => String(row['예약시작일']) === '20250516')

may16.forEach((row, i) => {
  const date = formatDate(row['예약시작일'])
  const timeSlot = getTimeSlot(row['예약시작시간'], row['예약종료시간'])
  const equipmentTypes = parseEquipmentOptions(row['옵션'])
  const companyName = normalizeCompanyName(row['신청기업명'])

  console.log(`${i + 1}. ${row['신청기업명']}`)
  console.log(`   상태: ${row['예약상태']}`)
  console.log(`   옵션 원본: ${JSON.stringify(row['옵션'])}`)
  console.log(`   파싱된 장비: ${JSON.stringify(equipmentTypes)}`)
  console.log(`   날짜: ${date}`)
  console.log(`   시간대: ${timeSlot}`)
  console.log(`   정규화된 회사명: ${companyName}`)
  console.log('')
})

// 필터링 조건 확인
console.log('=== 필터링 조건 확인 ===')
may16.forEach((row, i) => {
  const status = row['예약상태']
  const date = formatDate(row['예약시작일'])
  const companyName = normalizeCompanyName(row['신청기업명'])
  const equipmentTypes = parseEquipmentOptions(row['옵션'])

  const passStatusFilter = status === '확정' || status === '완료'
  const passDateFilter = !!date
  const passCompanyFilter = !!companyName
  const passEquipmentFilter = equipmentTypes.length > 0

  console.log(`${i + 1}. ${row['신청기업명']}`)
  console.log(`   상태 필터 통과: ${passStatusFilter} (${status})`)
  console.log(`   날짜 필터 통과: ${passDateFilter}`)
  console.log(`   회사명 필터 통과: ${passCompanyFilter}`)
  console.log(`   장비 필터 통과: ${passEquipmentFilter} (${equipmentTypes.length}개)`)
  console.log(`   최종 포함 여부: ${passStatusFilter && passDateFilter && passCompanyFilter && passEquipmentFilter}`)
  console.log('')
})
