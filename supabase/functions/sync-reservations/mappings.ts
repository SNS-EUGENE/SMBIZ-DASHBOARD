// smbiz.sba.kr 코드 → DB 값 매핑 상수
// 원본: scripts/scrape-smbiz.js

/** 예약상태 코드 → DB status */
export const STATUS_MAP: Record<string, string> = {
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

/** 기업규모 코드 → DB company_size */
export const COMPANY_SIZE_MAP: Record<string, string> = {
  'S02_0': '소공인',
  'S02_1': '소기업',
  'S02_2': '중기업',
  '소공인': '소공인',
  '소기업': '소기업',
  '중기업': '중기업',
}

/** 업종 코드 → DB industry */
export const INDUSTRY_MAP: Record<string, string> = {
  'S01_0': '주얼리',
  'S01_1': '수제화',
  'S01_2': '기계금속',
  'S01_3': '의류봉제',
  'S01_4': '인쇄',
  'S01_5': '뷰티',
  'S01_6': '기타',
}

/** 장비 opt_code → DB equipment type */
export const EQUIPMENT_CODE_MAP: Record<string, string> = {
  'OP_2_0': 'AS360',
  'OP_2_1': 'MICRO',
  'OP_2_2': 'XL',
  'OP_2_3': '알파데스크',
  'OP_2_4': '알파테이블',
  'OP_2_5': 'Compact',
  'OP_2_6': 'XXL',
}

/** 장비 이름 → DB equipment type (fallback) */
export const EQUIPMENT_NAME_MAP: Record<string, string> = {
  'XXL': 'XXL',
  'XL': 'XL',
  'Compact': 'Compact',
  'MICRO': 'MICRO',
  'AS360': 'AS360',
  '알파데스크': '알파데스크',
  '알파테이블': '알파테이블',
}

// ── 유틸리티 함수 ──

/** YYYYMMDD → YYYY-MM-DD */
export function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const s = String(dateStr).replace(/[^0-9]/g, '')
  if (s.length !== 8) return null
  return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`
}

/** "09" or "14시" → 'morning'/'afternoon' */
export function deriveTimeSlot(startTime: string | null | undefined): 'morning' | 'afternoon' {
  if (!startTime) return 'morning'
  const hour = parseInt(String(startTime).replace(/[^0-9]/g, ''))
  if (isNaN(hour)) return 'morning'
  if (hour >= 9 && hour < 14) return 'morning'
  if (hour >= 14 && hour <= 23) return 'afternoon'
  return 'morning'
}

/** "09" → "09시" */
export function formatTimeForDB(timeVal: string | null | undefined): string | null {
  if (!timeVal) return null
  const s = String(timeVal).trim()
  if (s.includes('시')) return s
  return `${s}시`
}

export function mapStatus(smbizStatus: string | null | undefined): string {
  if (!smbizStatus) return 'confirmed'
  return STATUS_MAP[smbizStatus.trim()] || 'confirmed'
}

export function mapCompanySize(smbizSize: string | null | undefined): string | null {
  if (!smbizSize) return null
  return COMPANY_SIZE_MAP[smbizSize.trim()] || smbizSize.trim() || null
}

export function mapIndustry(smbizSector: string | null | undefined): string {
  if (!smbizSector) return '기타'
  return INDUSTRY_MAP[smbizSector.trim()] || smbizSector.trim() || '기타'
}
