/**
 * facilityReserve.xlsx 옵션 컬럼 분석
 */

import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const facilityReserveFile = path.join(__dirname, '..', 'facilityReserve.xlsx')

console.log('📊 facilityReserve.xlsx 옵션 컬럼 분석\n')

if (!fs.existsSync(facilityReserveFile)) {
  console.error('❌ 파일을 찾을 수 없습니다:', facilityReserveFile)
  process.exit(1)
}

const workbook = XLSX.readFile(facilityReserveFile)
const sheet = workbook.Sheets['Sheet1']
const data = XLSX.utils.sheet_to_json(sheet)

console.log(`총 ${data.length}건의 데이터\n`)

// 옵션 컬럼 분석
let hasOption = 0
let noOption = 0
let emptyOption = 0

const optionValues = new Map()
const noOptionCompanies = []

data.forEach(row => {
  const option = row['옵션']
  const status = row['예약상태']

  // 확정/완료 상태만 분석
  if (status !== '확정' && status !== '완료') return

  if (option === undefined || option === null) {
    noOption++
    noOptionCompanies.push({
      company: row['신청기업명'],
      date: row['예약시작일'],
      status
    })
  } else if (option.toString().trim() === '') {
    emptyOption++
    noOptionCompanies.push({
      company: row['신청기업명'],
      date: row['예약시작일'],
      status
    })
  } else {
    hasOption++
    const optionStr = option.toString().trim()
    optionValues.set(optionStr, (optionValues.get(optionStr) || 0) + 1)
  }
})

console.log('📋 확정/완료 상태 예약 옵션 분석:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`✅ 옵션 있음: ${hasOption}건`)
console.log(`❌ 옵션 없음 (undefined/null): ${noOption}건`)
console.log(`⚠️ 옵션 빈 문자열: ${emptyOption}건`)
console.log(`📊 총 문제 예약: ${noOption + emptyOption}건\n`)

console.log('📝 옵션 값 종류 (상위 20개):')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const sortedOptions = [...optionValues.entries()].sort((a, b) => b[1] - a[1])
sortedOptions.slice(0, 20).forEach(([option, count], i) => {
  const preview = option.replace(/\n/g, ' / ').substring(0, 50)
  console.log(`${i + 1}. "${preview}" - ${count}건`)
})

console.log('\n\n📋 옵션 없는 예약 샘플 (최대 30건):')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
noOptionCompanies.slice(0, 30).forEach((item, i) => {
  console.log(`${i + 1}. ${item.date} | ${item.company} | ${item.status}`)
})

if (noOptionCompanies.length > 30) {
  console.log(`\n... 외 ${noOptionCompanies.length - 30}건 더 있음`)
}
