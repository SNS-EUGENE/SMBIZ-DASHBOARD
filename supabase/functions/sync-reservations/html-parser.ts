// smbiz HTML 응답 파싱 유틸
// Deno 환경 — 정규식 기반 (외부 DOM 파서 불필요)

export interface EquipmentItem {
  code: string   // e.g. "OP_2_4"
  label: string  // e.g. "알파테이블"
}

export interface DetailData {
  status_code: string
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  equipment: EquipmentItem[]
  company_name: string
  representative: string
  business_number: string
  company_size_code: string
  industry_code: string
  contact: string
  request_notes: string
  memo: string
  business_license_fidx: string | null
  small_biz_cert_fidx: string | null
}

/** HTML 엔티티 디코딩 */
function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** HTML 태그 제거 후 텍스트만 추출 */
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).trim()
}

/** input value 추출: <input name="xxx" value="yyy"> */
function getInputValue(html: string, name: string): string {
  // name="xxx" ... value="yyy" 또는 value="yyy" ... name="xxx"
  const patterns = [
    new RegExp(`<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i'),
    new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return decodeEntities(m[1])
  }
  return ''
}

/** select의 선택된 option value 추출 */
function getSelectedValue(html: string, name: string): string {
  // <select name="xxx">...</select> 블록을 찾고 그 안에서 selected option의 value
  const selectRe = new RegExp(
    `<select[^>]*name=["']${name}["'][^>]*>([\\s\\S]*?)</select>`,
    'i'
  )
  const selectMatch = html.match(selectRe)
  if (!selectMatch) return ''

  const optionBlock = selectMatch[1]
  // selected option의 value
  const selectedRe = /<option[^>]*value=["']([^"']*)["'][^>]*selected/i
  const selectedMatch = optionBlock.match(selectedRe)
  if (selectedMatch) return decodeEntities(selectedMatch[1])

  // selected가 value 앞에 올 수도 있음
  const selectedRe2 = /<option[^>]*selected[^>]*value=["']([^"']*)["']/i
  const selectedMatch2 = optionBlock.match(selectedRe2)
  if (selectedMatch2) return decodeEntities(selectedMatch2[1])

  return ''
}

/** textarea value 추출 */
function getTextareaValue(html: string, name: string): string {
  const re = new RegExp(
    `<textarea[^>]*name=["']${name}["'][^>]*>([\\s\\S]*?)</textarea>`,
    'i'
  )
  const m = html.match(re)
  if (!m) return ''
  return stripTags(m[1])
}

// ── 목록 페이지 파싱 ──

/** 목록 HTML에서 reserve_idx 배열 추출 */
export function parseListPage(html: string): string[] {
  const ids: string[] = []
  // fn_egov_View('xxx') 패턴에서 reserve_idx 추출
  const re = /fn_egov_View\(['"]([^'"]+)['"]\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    // 디지털콘텐츠 제작실(3F) 필터링 — 같은 행의 텍스트 확인
    ids.push(m[1])
  }
  return ids
}

/** 목록 HTML에서 디지털콘텐츠 제작실(3F) 예약만 필터 */
export function parseListPageFiltered(html: string, facilityFilter: string): string[] {
  const ids: string[] = []
  // fn_egov_View 각 위치에서 주변 텍스트(앞뒤 500자)에 시설명이 포함되는지 확인
  const re = /fn_egov_View\(['"]([^'"]+)['"]\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const idx = m.index
    // 이 링크 주변 컨텍스트에서 시설명 확인
    const contextStart = Math.max(0, idx - 200)
    const contextEnd = Math.min(html.length, idx + 500)
    const context = html.substring(contextStart, contextEnd)
    if (context.includes(facilityFilter)) {
      ids.push(m[1])
    }
  }
  return ids
}

/** 최대 페이지 수 추출 */
export function parseTotalPages(html: string): number {
  let maxPage = 1
  const re = /fn_egov_link_page\((\d+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const p = parseInt(m[1])
    if (p > maxPage) maxPage = p
  }
  return maxPage
}

// ── 상세 페이지 파싱 ──

/** 상세 HTML에서 예약 데이터 추출 */
export function parseDetailPage(html: string): DetailData {
  // 체크된 장비 — name="opt_code"인 input 중 checked 속성이 있는 것
  const equipment: EquipmentItem[] = []
  const inputRe = /<input[^>]*name=["']opt_code["'][^>]*>/gi
  let eqMatch: RegExpExecArray | null
  while ((eqMatch = inputRe.exec(html)) !== null) {
    const tag = eqMatch[0]
    // checked 속성 확인 (checked, checked="checked", checked="true" 등)
    if (!/\bchecked\b/i.test(tag)) continue

    // value 추출
    const valueMatch = tag.match(/value=["']([^"']*)["']/)
    if (!valueMatch) continue

    const code = valueMatch[1]
    // label: 체크박스 직후 텍스트
    const afterIdx = eqMatch.index + eqMatch[0].length
    const afterText = html.substring(afterIdx, afterIdx + 100)
    const labelMatch = afterText.match(/^\s*([^<]+)/)
    equipment.push({
      code,
      label: labelMatch ? labelMatch[1].trim() : '',
    })
  }

  // 대표자명: <th>대표자명</th><td>텍스트</td>
  let representative = ''
  const repRe = /<th[^>]*>\s*대표자명\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i
  const repMatch = html.match(repRe)
  if (repMatch) {
    const tdContent = repMatch[1]
    if (!/<input|<select|<textarea/i.test(tdContent)) {
      representative = stripTags(tdContent)
    }
  }

  // 파일 다운로드 링크 (f_idx)
  let business_license_fidx: string | null = null
  let small_biz_cert_fidx: string | null = null

  const fileSections = html.matchAll(
    /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
  )
  for (const section of fileSections) {
    const thText = stripTags(section[1])
    const tdContent = section[2]
    const fidxMatch = tdContent.match(/f_idx=(\d+)/)
    if (!fidxMatch) continue

    if (thText.includes('사업자등록증')) {
      business_license_fidx = fidxMatch[1]
    } else if (thText.includes('소상공인확인서')) {
      small_biz_cert_fidx = fidxMatch[1]
    }
  }

  return {
    status_code: getSelectedValue(html, 'reserve_status'),
    start_date: getInputValue(html, 's_date'),
    end_date: getInputValue(html, 'e_date'),
    start_time: getSelectedValue(html, 's_time'),
    end_time: getSelectedValue(html, 'e_time'),
    equipment,
    company_name: getInputValue(html, 'company'),
    representative,
    business_number: getInputValue(html, 'biz_num'),
    company_size_code: getSelectedValue(html, 'size'),
    industry_code: getSelectedValue(html, 'sector'),
    contact: getInputValue(html, 'tel'),
    request_notes: getTextareaValue(html, 'note'),
    memo: getTextareaValue(html, 'memo'),
    business_license_fidx,
    small_biz_cert_fidx,
  }
}
