/**
 * smbiz.sba.kr 예약 데이터 스크래핑 스크립트
 *
 * 디지털콘텐츠 제작실(3F) 예약 데이터를 스크래핑하여
 * companies, reservations, reservation_equipment 테이블에 저장
 *
 * 사용법:
 *   node scripts/scrape-smbiz.js                    # 전체
 *   node scripts/scrape-smbiz.js --start=1 --end=5  # 범위 지정
 *   node scripts/scrape-smbiz.js --resume            # 이어하기
 *   node scripts/scrape-smbiz.js --clean             # 테이블 비우고 시작
 */

import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================
// 설정
// ============================================

const BASE_URL = 'https://smbiz.sba.kr'
const LOGIN_URL = `${BASE_URL}/biz_manage/index.do`
const LIST_URL = `${BASE_URL}/biz_manage/facilityReserve/list.do`
const DETAIL_URL = `${BASE_URL}/biz_manage/facilityReserve/updateForm.do`
const FILE_DOWNLOAD_URL = `${BASE_URL}/file/download.do`

const IDS_FILE = path.join(__dirname, '.scrape-ids.json')       // Phase 1 결과
const PROGRESS_FILE = path.join(__dirname, '.scrape-progress.json')  // Phase 2 진행
const ERROR_LOG = path.join(__dirname, '.scrape-errors.log')

const DELAY_DETAIL = 500   // 상세 페이지 간 딜레이 (ms)
const DELAY_LIST = 1000    // 목록 페이지 간 딜레이 (ms)
const MAX_CONSECUTIVE_ERRORS = 3
const FACILITY_FILTER = '디지털콘텐츠 제작실(3F)'

// ============================================
// Supabase 클라이언트
// ============================================

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 .env에 없습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================
// 매핑 상수
// ============================================

// smbiz 예약상태 → DB status
// 코드값: R01_0=신청, R01_1=확정, R01_2=완료, R01_3=취소
const STATUS_MAP = {
  'R01_0': 'pending',
  'R01_1': 'confirmed',
  'R01_2': 'completed',
  'R01_3': 'cancelled',
  // 텍스트 fallback
  '신청': 'pending',
  '확정': 'confirmed',
  '완료': 'completed',
  '취소': 'cancelled',
}

// smbiz 기업규모 → DB company_size
// 코드값: S02_0=소공인, S02_1=소기업, S02_2=중기업
const COMPANY_SIZE_MAP = {
  'S02_0': '소공인',
  'S02_1': '소기업',
  'S02_2': '중기업',
  // 텍스트 fallback
  '소공인': '소공인',
  '소기업': '소기업',
  '중기업': '중기업',
}

// smbiz 업종 → DB industry
// 코드값: S01_0~S01_6
const INDUSTRY_MAP = {
  'S01_0': '주얼리',
  'S01_1': '수제화',
  'S01_2': '기계금속',
  'S01_3': '의류봉제',
  'S01_4': '인쇄',
  'S01_5': '뷰티',
  'S01_6': '기타',
}

// smbiz 장비 opt_code → DB equipment type
// OP_2_0~OP_2_6 (체크박스 value)
const EQUIPMENT_CODE_MAP = {
  'OP_2_0': 'AS360',
  'OP_2_1': 'MICRO',
  'OP_2_2': 'XL',
  'OP_2_3': '알파데스크',
  'OP_2_4': '알파테이블',
  'OP_2_5': 'Compact',
  'OP_2_6': 'XXL',
}

// 장비 이름 → DB equipment type (fallback)
const EQUIPMENT_NAME_MAP = {
  'XXL': 'XXL',
  'XL': 'XL',
  'Compact': 'Compact',
  'MICRO': 'MICRO',
  'AS360': 'AS360',
  '알파데스크': '알파데스크',
  '알파테이블': '알파테이블',
}

// ============================================
// 유틸리티
// ============================================

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/** YYYYMMDD → YYYY-MM-DD */
function formatDate(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).replace(/[^0-9]/g, '')
  if (s.length !== 8) return null
  return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`
}

/** "09" or "14시" → 'morning'/'afternoon' */
function deriveTimeSlot(startTime) {
  if (!startTime) return 'morning'
  const hour = parseInt(String(startTime).replace(/[^0-9]/g, ''))
  if (isNaN(hour)) return 'morning'
  if (hour >= 9 && hour < 14) return 'morning'
  if (hour >= 14 && hour <= 23) return 'afternoon'
  return 'morning'
}

/** "09" → "09시", pass-through if already has 시 */
function formatTimeForDB(timeVal) {
  if (!timeVal) return null
  const s = String(timeVal).trim()
  if (s.includes('시')) return s
  return `${s}시`
}

function mapStatus(smbizStatus) {
  if (!smbizStatus) return 'confirmed'
  return STATUS_MAP[smbizStatus.trim()] || 'confirmed'
}

function mapCompanySize(smbizSize) {
  if (!smbizSize) return null
  return COMPANY_SIZE_MAP[smbizSize.trim()] || smbizSize.trim() || null
}

function mapIndustry(smbizSector) {
  if (!smbizSector) return '기타'
  return INDUSTRY_MAP[smbizSector.trim()] || smbizSector.trim() || '기타'
}

function logError(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`
  fs.appendFileSync(ERROR_LOG, line, 'utf-8')
  console.error(`  ⚠️  ${message}`)
}

// ============================================
// 진행 상태 관리
// ============================================

// Phase 1 ID 목록 저장/로드
function saveIds(ids, meta) {
  fs.writeFileSync(IDS_FILE, JSON.stringify({ ids, ...meta, timestamp: new Date().toISOString() }, null, 2), 'utf-8')
}

function loadIds() {
  if (fs.existsSync(IDS_FILE)) {
    return JSON.parse(fs.readFileSync(IDS_FILE, 'utf-8'))
  }
  return null
}

// Phase 2 진행 저장/로드 (건별)
function saveProgress(lastIndex, processedCount, errorCount) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    lastIndex,
    processedCount,
    errorCount,
    timestamp: new Date().toISOString()
  }), 'utf-8')
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
  }
  return null
}

function clearProgress() {
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE)
  if (fs.existsSync(IDS_FILE)) fs.unlinkSync(IDS_FILE)
}

// ============================================
// CLI 인자 파싱
// ============================================

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { start: 1, end: null, resume: false, clean: false }

  for (const arg of args) {
    if (arg === '--resume') opts.resume = true
    else if (arg === '--clean') opts.clean = true
    else if (arg.startsWith('--start=')) opts.start = parseInt(arg.split('=')[1])
    else if (arg.startsWith('--end=')) opts.end = parseInt(arg.split('=')[1])
  }

  return opts
}

// ============================================
// 로그인
// ============================================

async function login(page) {
  const adminId = process.env.SMBIZ_ADMIN_ID
  const adminPw = process.env.SMBIZ_ADMIN_PW

  if (!adminId || !adminPw) {
    throw new Error('SMBIZ_ADMIN_ID / SMBIZ_ADMIN_PW가 .env에 없습니다.')
  }

  console.log('🔐 로그인 중...')

  // User-Agent 설정 (headless 감지 방지)
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  // alert() 다이얼로그 핸들링 (로그인 실패 메시지 캡처)
  let alertMessage = null
  page.on('dialog', async (dialog) => {
    alertMessage = dialog.message()
    console.log(`  [ALERT] ${alertMessage}`)
    await dialog.dismiss()
  })

  await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 })

  // 실제 smbiz 로그인 폼: name="id" (id="ad_id"), name="pw" (id="ad_pw")
  await page.evaluate((id, pw) => {
    document.querySelector('#ad_id').value = id
    document.querySelector('#ad_pw').value = pw
  }, adminId, adminPw)

  // input[type="image"] 클릭으로 제출
  const imageSubmit = await page.$('input[type="image"]')
  if (imageSubmit) {
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        imageSubmit.click()
      ])
    } catch (navErr) {
      console.log(`  로그인 navigation: ${page.url()}`)
    }
  } else {
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.evaluate(() => document.forms[0].submit())
      ])
    } catch (navErr) {
      console.log(`  로그인 navigation: ${page.url()}`)
    }
  }

  // alert이 떴으면 로그인 실패
  if (alertMessage) {
    throw new Error(`로그인 실패 — 서버 응답: "${alertMessage}"`)
  }

  console.log(`  로그인 후 URL: ${page.url()}`)

  // 로그인 성공 확인: 목록 페이지로 이동 시도
  await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 30000 })
  const currentUrl = page.url()
  console.log(`  목록 페이지 URL: ${currentUrl}`)

  if (currentUrl.includes('index.do') || currentUrl.includes('login')) {
    throw new Error('로그인 실패 — credential을 확인하세요.')
  }

  console.log('✅ 로그인 성공\n')
}

// ============================================
// 목록 페이지 순회
// ============================================

async function getListPage(page, pageIndex) {
  // eGovFrame 패턴: document.listForm.pageIndex + submit
  await page.evaluate((idx) => {
    document.listForm.pageIndex.value = idx
    document.listForm.action = '/biz_manage/facilityReserve/list.do'
    document.listForm.submit()
  }, pageIndex)

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })

  // 목록 테이블에서 f_res_idx 추출
  const items = await page.evaluate((filter) => {
    const rows = []
    const allTrs = document.querySelectorAll('table.style5 tbody tr')

    for (const tr of allTrs) {
      const tds = tr.querySelectorAll('td')
      if (tds.length < 3) continue

      // 이용시설 td (3번째 = index 2) 내 a 태그에서 시설명과 onclick 추출
      for (const td of tds) {
        const anchor = td.querySelector('a[onclick*="fn_egov_View"]')
        if (!anchor) continue

        const text = anchor.textContent?.trim() || ''
        if (!text.includes(filter)) continue

        const onclick = anchor.getAttribute('onclick') || ''
        const match = onclick.match(/fn_egov_View\(['"]([^'"]+)['"]\)/)
        if (match) {
          rows.push({ reserve_idx: match[1] })
        }
        break
      }
    }
    return rows
  }, FACILITY_FILTER)

  return items
}

/** 전체 페이지 수 감지 — .paging div 내 fn_egov_link_page() 링크에서 추출 */
async function getTotalPages(page) {
  return await page.evaluate(() => {
    // .paging div 안의 모든 a 태그에서 fn_egov_link_page(N) 추출
    const pagingLinks = document.querySelectorAll('.paging a')
    let maxPage = 1
    for (const link of pagingLinks) {
      const onclick = link.getAttribute('onclick') || ''
      const match = onclick.match(/fn_egov_link_page\((\d+)\)/)
      if (match) {
        maxPage = Math.max(maxPage, parseInt(match[1]))
      }
    }
    return maxPage
  })
}

// ============================================
// 상세 페이지 파싱
// ============================================

async function getDetailPage(page, reserveIdx) {
  // POST로 상세 페이지 이동 — document.listForm.f_res_idx 사용
  await page.evaluate((idx) => {
    document.listForm.f_res_idx.value = idx
    document.listForm.action = '/biz_manage/facilityReserve/updateForm.do'
    document.listForm.submit()
  }, reserveIdx)

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })

  // 필드 추출 — 실제 smbiz detailForm 셀렉터 기반
  const data = await page.evaluate(() => {
    const frm = document.detailForm

    // 헬퍼: input/textarea value
    const val = (name) => {
      const el = frm?.[name] || document.querySelector(`[name="${name}"]`)
      if (!el) return ''
      return (el.value || '').trim()
    }

    // 헬퍼: select의 raw value (코드값)
    const selCode = (name) => {
      const el = frm?.[name] || document.querySelector(`select[name="${name}"]`)
      if (!el) return ''
      return (el.value || '').trim()
    }

    // 헬퍼: select의 보이는 텍스트
    const selText = (name) => {
      const el = frm?.[name] || document.querySelector(`select[name="${name}"]`)
      if (!el || !el.options || el.selectedIndex < 0) return ''
      return (el.options[el.selectedIndex]?.text || '').trim()
    }

    // 체크된 장비 — opt_code 체크박스
    const equipmentChecked = [...document.querySelectorAll('input[name="opt_code"]:checked')]
      .map(el => ({
        code: el.value,                                       // e.g. "OP_2_4"
        label: el.nextSibling?.textContent?.trim() || '',     // e.g. "알파테이블"
      }))

    // 대표자명: <th>대표자명</th><td>텍스트</td> (input 아닌 plain text)
    let representative = ''
    for (const th of document.querySelectorAll('th')) {
      if (th.textContent?.trim() === '대표자명') {
        const td = th.nextElementSibling
        if (td && !td.querySelector('input, select, textarea')) {
          representative = td.textContent?.trim() || ''
        }
        break
      }
    }

    // 파일 다운로드 링크 (기존 업로드된 파일이 있으면 a 태그로 표시됨)
    let bizLicenseFidx = null
    let smallBizCertFidx = null
    for (const th of document.querySelectorAll('th')) {
      const label = th.textContent?.trim() || ''
      const td = th.nextElementSibling
      if (!td) continue

      // a[href*="f_idx"] 또는 a[onclick*="f_idx"] 찾기
      const link = td.querySelector('a[href*="f_idx"], a[onclick*="f_idx"]')
      if (!link) continue

      const href = (link.getAttribute('href') || '') + (link.getAttribute('onclick') || '')
      const match = href.match(/f_idx=(\d+)/)
      if (!match) continue

      if (label.includes('사업자등록증')) {
        bizLicenseFidx = match[1]
      } else if (label.includes('소상공인확인서')) {
        smallBizCertFidx = match[1]
      }
    }

    return {
      status_code: selCode('reserve_status'),   // "R01_1"
      status_text: selText('reserve_status'),   // "확정"
      start_date: val('s_date'),                // "20260225"
      end_date: val('e_date'),                  // "20260225"
      start_time: selCode('s_time'),            // "14" (raw value)
      start_time_text: selText('s_time'),       // "14시"
      end_time: selCode('e_time'),              // "18"
      end_time_text: selText('e_time'),         // "18시"
      equipment: equipmentChecked,              // [{code, label}]
      company_name: val('company'),             // "주식회사 어네이티브컴퍼니"
      representative,                           // "윤여건"
      business_number: val('biz_num'),          // "5788803075"
      company_size_code: selCode('size'),       // "S02_1"
      company_size_text: selText('size'),       // "소기업"
      industry_code: selCode('sector'),         // "S01_3"
      industry_text: selText('sector'),         // "의류봉제"
      contact: val('tel'),                      // "010-4404-5098"
      request_notes: val('note'),               // 요청사항 textarea
      memo: val('memo'),                        // 메모 textarea
      business_license_fidx: bizLicenseFidx,
      small_biz_cert_fidx: smallBizCertFidx,
    }
  })

  return data
}

// ============================================
// 파일 다운로드 → Supabase Storage
// ============================================

async function downloadAndUpload(page, fidx, reserveIdx, fileType) {
  if (!fidx) return null

  try {
    const cookies = await page.cookies()
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const res = await fetch(`${FILE_DOWNLOAD_URL}?f_idx=${fidx}`, {
      headers: { Cookie: cookieStr },
      redirect: 'follow'
    })

    if (!res.ok) {
      logError(`파일 다운로드 실패 (f_idx=${fidx}): HTTP ${res.status}`)
      return null
    }

    const buffer = Buffer.from(await res.arrayBuffer())

    // Content-Disposition에서 파일명 추출
    const disposition = res.headers.get('content-disposition') || ''
    let filename = `${fidx}.pdf`

    // RFC 5987 (filename*=UTF-8''...)
    const utf8Match = disposition.match(/filename\*=UTF-8''([^\s;]+)/i)
    if (utf8Match) {
      filename = decodeURIComponent(utf8Match[1])
    } else {
      // 일반 filename="..."
      const simpleMatch = disposition.match(/filename=["']?([^"';\n]+)/)
      if (simpleMatch) {
        filename = simpleMatch[1].trim()
      }
    }

    // 파일명에서 확장자 추출, 한글/특수문자 제거하여 ASCII-safe 경로 생성
    const ext = path.extname(filename) || '.pdf'
    const storagePath = `${fileType}/${reserveIdx}_${fidx}${ext}`

    const { error } = await supabase.storage
      .from('smbiz-files')
      .upload(storagePath, buffer, {
        contentType: res.headers.get('content-type') || 'application/octet-stream',
        upsert: true
      })

    if (error) {
      logError(`Storage 업로드 실패 (${storagePath}): ${error.message}`)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('smbiz-files')
      .getPublicUrl(storagePath)

    return publicUrl
  } catch (err) {
    logError(`파일 처리 에러 (f_idx=${fidx}): ${err.message}`)
    return null
  }
}

// ============================================
// DB 저장
// ============================================

/** 장비 ID 캐시 */
const equipmentIdCache = {}

async function getEquipmentId(type) {
  if (equipmentIdCache[type]) return equipmentIdCache[type]

  const { data } = await supabase
    .from('equipment')
    .select('id')
    .eq('type', type)
    .limit(1)
    .maybeSingle()

  if (data) {
    equipmentIdCache[type] = data.id
    return data.id
  }
  return null
}

/** 기업 upsert — business_number 기준 dedup */
async function upsertCompany(detail) {
  const businessNumber = detail.business_number?.trim()

  // business_number가 있으면 그걸로 매칭
  if (businessNumber) {
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('business_number', businessNumber)
      .maybeSingle()

    if (existing) return existing.id
  }

  // 새 기업 생성
  const insertData = {
    name: detail.company_name?.trim() || '(미상)',
    representative: detail.representative?.trim() || '',
    business_number: businessNumber || null,
    company_size: mapCompanySize(detail.company_size_code),
    industry: mapIndustry(detail.industry_code),
    contact: detail.contact?.trim() || '',
  }

  const { data: created, error } = await supabase
    .from('companies')
    .insert(insertData)
    .select('id')
    .single()

  if (error) {
    // UNIQUE violation → 이미 존재 (race condition)
    if (error.code === '23505' && businessNumber) {
      const { data: found } = await supabase
        .from('companies')
        .select('id')
        .eq('business_number', businessNumber)
        .single()
      return found?.id || null
    }
    logError(`기업 생성 실패 (${insertData.name}): ${error.message}`)
    return null
  }

  return created.id
}

/** 예약 upsert — reserve_idx 기준 */
async function upsertReservation(companyId, reserveIdx, detail) {
  const startDate = formatDate(detail.start_date)
  const endDate = formatDate(detail.end_date)

  if (!startDate) {
    logError(`날짜 파싱 실패 (reserve_idx=${reserveIdx}): start_date=${detail.start_date}`)
    return null
  }

  const insertData = {
    reserve_idx: reserveIdx,
    company_id: companyId,
    reservation_date: startDate,
    end_date: endDate,
    time_slot: deriveTimeSlot(detail.start_time),
    start_time: formatTimeForDB(detail.start_time),     // "14" → "14시"
    end_time: formatTimeForDB(detail.end_time),          // "18" → "18시"
    status: mapStatus(detail.status_code),               // "R01_1" → "confirmed"
    request_notes: detail.request_notes || null,
    business_license_url: detail.business_license_url || null,
    small_biz_cert_url: detail.small_biz_cert_url || null,
    // 기본값
    work_2d: 0,
    work_3d: 0,
    work_video: 0,
    work_advanced: 0,
    attendees: 1,
    is_training: false,
    is_seminar: false,
  }

  const { data: reservation, error } = await supabase
    .from('reservations')
    .upsert(insertData, { onConflict: 'reserve_idx' })
    .select('id')
    .single()

  if (error) {
    logError(`예약 upsert 실패 (${reserveIdx}): ${error.message}`)
    return null
  }

  return reservation.id
}

/** 장비 매핑 — equipment 배열은 [{code: "OP_2_4", label: "알파테이블"}, ...] 형태 */
async function linkEquipment(reservationId, equipmentItems) {
  if (!reservationId || !equipmentItems?.length) return

  // 기존 매핑 삭제
  await supabase.from('reservation_equipment')
    .delete()
    .eq('reservation_id', reservationId)

  for (const item of equipmentItems) {
    // 1차: opt_code → 장비타입 매핑
    let type = EQUIPMENT_CODE_MAP[item.code]

    // 2차: label 텍스트로 fallback
    if (!type && item.label) {
      type = EQUIPMENT_NAME_MAP[item.label]
    }

    if (!type) {
      logError(`알 수 없는 장비: code="${item.code}" label="${item.label}"`)
      continue
    }

    const equipmentId = await getEquipmentId(type)
    if (!equipmentId) {
      logError(`장비 ID 없음: type="${type}"`)
      continue
    }

    const { error } = await supabase.from('reservation_equipment')
      .insert({
        reservation_id: reservationId,
        equipment_id: equipmentId,
      })

    if (error && error.code !== '23505') { // 중복 무시
      logError(`장비 매핑 실패 (${reservationId} → ${type}): ${error.message}`)
    }
  }
}

// ============================================
// 테이블 비우기 (--clean)
// ============================================

async function cleanTables() {
  console.log('🗑️  테이블 비우기 시작...')

  // FK 의존성 순서대로 삭제
  const tables = ['reservation_equipment', 'satisfaction_surveys', 'reservations', 'companies']

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error(`  ❌ ${table} 비우기 실패: ${error.message}`)
    } else {
      console.log(`  ✅ ${table} 비움`)
    }
  }

  console.log('')
}

// ============================================
// 메인 실행
// ============================================

// ============================================
// Phase 1: 목록 순회 → ID 수집
// ============================================

async function phase1_collectIds(page, startPage, endPage) {
  console.log('\n══════════════════════════════════════')
  console.log('  Phase 1: 예약 ID 수집')
  console.log('══════════════════════════════════════')

  const totalPages = endPage || await getTotalPages(page)
  console.log(`  목록 페이지: ${startPage} ~ ${totalPages} (총 ${totalPages - startPage + 1}페이지)\n`)

  const allIds = []
  let consecutiveErrors = 0

  for (let pageIdx = startPage; pageIdx <= totalPages; pageIdx++) {
    try {
      const items = await getListPage(page, pageIdx)
      const ids = items.map(i => i.reserve_idx)
      allIds.push(...ids)

      // 10페이지마다 중간저장
      if (pageIdx % 10 === 0 || ids.length > 0) {
        saveIds(allIds, { lastPage: pageIdx, totalPages })
      }

      const pct = ((pageIdx / totalPages) * 100).toFixed(1)
      if (ids.length > 0) {
        console.log(`  [${pct}%] 페이지 ${pageIdx}/${totalPages} → ${ids.length}건 (누적 ${allIds.length})`)
      } else if (pageIdx % 50 === 0) {
        // 50페이지마다 진행 표시 (디지털콘텐츠 없는 페이지는 조용히)
        console.log(`  [${pct}%] 페이지 ${pageIdx}/${totalPages} (누적 ${allIds.length})`)
      }

      consecutiveErrors = 0
      await delay(300)  // 목록만 볼 때는 빠르게
    } catch (err) {
      consecutiveErrors++
      logError(`Phase1 페이지 ${pageIdx} 에러: ${err.message}`)

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`\n❌ Phase1 중단 (${MAX_CONSECUTIVE_ERRORS}회 연속 에러)`)
        saveIds(allIds, { lastPage: pageIdx, totalPages, interrupted: true })
        throw new Error(`Phase1 중단: 페이지 ${pageIdx}`)
      }

      // 복귀 시도
      try {
        await page.goto(LIST_URL, { waitUntil: 'networkidle2' })
      } catch {
        await login(page)
      }
    }
  }

  // 최종 저장
  saveIds(allIds, { lastPage: totalPages, totalPages, complete: true })
  console.log(`\n  ✅ Phase 1 완료: ${allIds.length}건 수집\n`)
  return allIds
}

// ============================================
// Phase 2: ID별 상세 파싱 → DB 저장
// ============================================

async function phase2_scrapeDetails(page, ids, resumeIndex = 0) {
  console.log('\n══════════════════════════════════════')
  console.log('  Phase 2: 상세 데이터 수집 + DB 저장')
  console.log('══════════════════════════════════════')
  console.log(`  대상: ${ids.length}건 (시작 인덱스: ${resumeIndex})\n`)

  let processedCount = 0
  let errorCount = 0
  let consecutiveErrors = 0

  for (let i = resumeIndex; i < ids.length; i++) {
    const reserveIdx = ids[i]
    const pct = (((i + 1) / ids.length) * 100).toFixed(1)

    try {
      // 목록 페이지에 있어야 listForm 사용 가능
      // (첫 항목이거나 이전에 목록으로 돌아간 상태)

      const detail = await getDetailPage(page, reserveIdx)

      // 파일 다운로드 (있으면)
      if (detail.business_license_fidx) {
        detail.business_license_url = await downloadAndUpload(
          page, detail.business_license_fidx, reserveIdx, 'business-licenses'
        )
      }
      if (detail.small_biz_cert_fidx) {
        detail.small_biz_cert_url = await downloadAndUpload(
          page, detail.small_biz_cert_fidx, reserveIdx, 'small-biz-certs'
        )
      }

      // DB 저장
      const companyId = await upsertCompany(detail)
      if (!companyId) {
        logError(`기업 ID 없음 — 건너뜀 (${reserveIdx})`)
        errorCount++
        await page.goto(LIST_URL, { waitUntil: 'networkidle2' })
        saveProgress(i + 1, processedCount, errorCount)
        continue
      }

      const reservationId = await upsertReservation(companyId, reserveIdx, detail)
      if (!reservationId) {
        errorCount++
        await page.goto(LIST_URL, { waitUntil: 'networkidle2' })
        saveProgress(i + 1, processedCount, errorCount)
        continue
      }

      await linkEquipment(reservationId, detail.equipment)

      processedCount++
      consecutiveErrors = 0
      console.log(`  [${pct}%] ${i + 1}/${ids.length} [${reserveIdx}] ✅ ${detail.company_name} | ${detail.start_date} | ${detail.status_text}`)

      // 목록 페이지로 복귀 + 중간저장
      await page.goto(LIST_URL, { waitUntil: 'networkidle2' })
      saveProgress(i + 1, processedCount, errorCount)

      await delay(DELAY_DETAIL)
    } catch (err) {
      consecutiveErrors++
      errorCount++
      logError(`Phase2 [${reserveIdx}] 에러: ${err.message}`)

      // 복귀 시도
      try {
        await page.goto(LIST_URL, { waitUntil: 'networkidle2' })
      } catch {
        try { await login(page) } catch { /* ignore */ }
      }

      saveProgress(i + 1, processedCount, errorCount)

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`\n❌ Phase2 중단 (${MAX_CONSECUTIVE_ERRORS}회 연속 에러, index=${i})`)
        console.log(`  --resume 로 재개 가능`)
        throw new Error(`Phase2 중단: index ${i}`)
      }
    }
  }

  console.log(`\n  ✅ Phase 2 완료: 저장 ${processedCount}건, 에러 ${errorCount}건`)
  return { processedCount, errorCount }
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  const opts = parseArgs()

  console.log('═══════════════════════════════════════════')
  console.log('  smbiz.sba.kr 예약 데이터 스크래핑')
  console.log('═══════════════════════════════════════════')
  console.log(`  옵션: start=${opts.start}, end=${opts.end || 'auto'}, resume=${opts.resume}, clean=${opts.clean}`)
  console.log('')

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(20000)

  try {
    await login(page)

    if (opts.clean) {
      await cleanTables()
    }

    let ids
    let resumeIndex = 0

    if (opts.resume) {
      // 이전 ID 목록 로드
      const saved = loadIds()
      const progress = loadProgress()

      if (saved?.ids?.length) {
        ids = saved.ids
        resumeIndex = progress?.lastIndex || 0
        console.log(`📌 재개: ID ${ids.length}개 로드됨, ${resumeIndex}번째부터 계속`)

        if (!saved.complete) {
          // Phase 1이 미완이면 이어서 수집
          console.log(`  (Phase 1 미완 — 페이지 ${(saved.lastPage || 0) + 1}부터 추가 수집)`)
          const moreIds = await phase1_collectIds(page, (saved.lastPage || 0) + 1, saved.totalPages)
          ids = [...new Set([...ids, ...moreIds])]
          saveIds(ids, { totalPages: saved.totalPages, complete: true })
        }
      } else {
        console.log('  이전 진행 데이터 없음 — 처음부터 시작')
        opts.resume = false
      }
    }

    if (!opts.resume) {
      // Phase 1: ID 수집
      ids = await phase1_collectIds(page, opts.start, opts.end)
    }

    if (!ids.length) {
      console.log('\n  ⚠️  수집된 ID가 없습니다.')
      return
    }

    // Phase 2: 상세 수집 + DB 저장
    const result = await phase2_scrapeDetails(page, ids, resumeIndex)

    // 완료
    clearProgress()
    console.log('\n═══════════════════════════════════════════')
    console.log(`  ✅ 전체 스크래핑 완료!`)
    console.log(`  총 ID: ${ids.length}건`)
    console.log(`  저장: ${result.processedCount}건`)
    console.log(`  에러: ${result.errorCount}건`)
    console.log('═══════════════════════════════════════════')
  } catch (err) {
    console.error(`\n❌ 치명적 에러: ${err.message}`)
    logError(`치명적 에러: ${err.message}\n${err.stack}`)
    console.log('  --resume 으로 재개 가능')
  } finally {
    await browser.close()
  }
}

main()
