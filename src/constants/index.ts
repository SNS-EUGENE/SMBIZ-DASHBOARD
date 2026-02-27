import type { EquipmentType, ReservationStatus, EquipmentStatus, StatusConfig } from '../types'

// 장비 타입 목록
export const EQUIPMENT_TYPES: EquipmentType[] = ['AS360', 'MICRO', 'XL', 'XXL', '알파데스크', '알파테이블', 'Compact']

// 장비별 HEX 색상 매핑
export const EQUIPMENT_COLORS: Record<string, string> = {
  'AS360': '#8B5CF6',
  'MICRO': '#3B82F6',
  'XL': '#10B981',
  'XXL': '#F59E0B',
  '알파데스크': '#EC4899',
  '알파테이블': '#06B6D4',
  'Compact': '#6366F1',
}

// 장비별 Tailwind CSS 클래스 매핑
export const EQUIPMENT_CSS_COLORS: Record<string, string> = {
  'AS360': 'equipment-as360',
  'MICRO': 'equipment-micro',
  'XL': 'equipment-xl',
  'XXL': 'equipment-xxl',
  '알파데스크': 'equipment-desk',
  '알파테이블': 'equipment-table',
  'Compact': 'equipment-compact',
}

// 차트 색상 팔레트
export const CHART_COLORS: string[] = ['#FF6363', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#14B8A6']

// 예약 상태 설정
export const RESERVATION_STATUS: Record<ReservationStatus, StatusConfig> = {
  pending: { label: '대기', class: 'badge-warning' },
  confirmed: { label: '확정', class: 'badge-info' },
  completed: { label: '완료', class: 'badge-success' },
  cancelled: { label: '취소', class: 'badge-muted' },
  no_show: { label: '노쇼', class: 'badge-danger' },
}

// 장비 상태 설정
export const EQUIPMENT_STATUS: Record<EquipmentStatus, StatusConfig> = {
  active: { label: '활성', class: 'badge-success' },
  maintenance: { label: '정비중', class: 'badge-warning' },
  inactive: { label: '비활성', class: 'badge-danger' },
}
