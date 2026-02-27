/**
 * 기존 테이블 데이터 백업 스크립트
 * companies, reservations, reservation_equipment, satisfaction_surveys를
 * JSON + CSV 형식으로 tmp/backup_YYYYMMDD/ 폴더에 저장
 *
 * 사용법: node scripts/backup-tables.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { format } from 'date-fns'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const dateStr = format(new Date(), 'yyyyMMdd_HHmmss')
const backupDir = path.join(__dirname, '..', 'tmp', `backup_${dateStr}`)

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function jsonToCsv(data) {
  if (!data || data.length === 0) return ''
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
      // CSV escape: wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

async function backupTable(tableName) {
  console.log(`  ${tableName} 백업 중...`)

  const { data, error } = await supabase
    .from(tableName)
    .select('*')

  if (error) {
    console.error(`  [ERROR] ${tableName}: ${error.message}`)
    return 0
  }

  if (!data || data.length === 0) {
    console.log(`  ${tableName}: 데이터 없음 (0건)`)
    return 0
  }

  // JSON 저장
  const jsonPath = path.join(backupDir, `${tableName}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8')

  // CSV 저장
  const csvPath = path.join(backupDir, `${tableName}.csv`)
  fs.writeFileSync(csvPath, jsonToCsv(data), 'utf-8')

  console.log(`  ${tableName}: ${data.length}건 → ${jsonPath}`)
  return data.length
}

async function main() {
  console.log('=== 테이블 데이터 백업 시작 ===')
  console.log(`백업 폴더: ${backupDir}\n`)

  ensureDir(backupDir)

  const tables = [
    'companies',
    'reservations',
    'reservation_equipment',
    'satisfaction_surveys'
  ]

  let totalRows = 0
  for (const table of tables) {
    const count = await backupTable(table)
    totalRows += count
  }

  console.log(`\n=== 백업 완료 ===`)
  console.log(`총 ${totalRows}건, 폴더: ${backupDir}`)

  // 백업 요약 메타데이터
  const metaPath = path.join(backupDir, '_backup_meta.json')
  fs.writeFileSync(metaPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    tables,
    totalRows,
    supabaseUrl
  }, null, 2), 'utf-8')
}

main().catch(console.error)
