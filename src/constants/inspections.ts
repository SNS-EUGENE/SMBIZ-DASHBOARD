// ========================================
// 시설 점검 항목
// ========================================

export interface FacilityCheckItem {
  key: string
  label: string
}

export interface FacilityCheckCategory {
  id: string
  label: string
  items: FacilityCheckItem[]
}

export const FACILITY_CHECK_CATEGORIES: FacilityCheckCategory[] = [
  {
    id: 'led',
    label: '전등 및 LED',
    items: [
      { key: 'led_infoDesk', label: '인포데스크 앞' },
      { key: 'led_studio', label: '제작실 내부' },
      { key: 'led_office', label: '운영사무실' },
      { key: 'led_storage', label: '자재보관실' },
    ],
  },
  {
    id: 'orbitview',
    label: '콘텐츠 제작실 오르빗뷰 장비',
    items: [
      { key: 'orb_largeTv', label: '대형 TV' },
      { key: 'orb_xxl', label: '알파스튜디오 XXL' },
      { key: 'orb_xlPro', label: '알파샷 XL PRO' },
      { key: 'orb_table', label: '알파테이블' },
      { key: 'orb_desk', label: '알파데스크' },
      { key: 'orb_360', label: '알파샷 360' },
      { key: 'orb_micro', label: '알파샷 마이크로' },
      { key: 'orb_compact', label: '알파스튜디오 컴팩트' },
    ],
  },
  {
    id: 'office',
    label: '운영사무실',
    items: [
      { key: 'office_clean', label: '청소 상태' },
      { key: 'office_damage', label: '파손 여부 확인' },
      { key: 'office_hvac', label: '냉/난방기 작동' },
      { key: 'office_vent', label: '환풍기 작동' },
    ],
  },
  {
    id: 'storage',
    label: '자재보관실',
    items: [
      { key: 'storage_clean', label: '청소 상태' },
      { key: 'storage_battery', label: '카메라 배터리 충전' },
      { key: 'storage_lens', label: '렌즈 및 보관 자재' },
      { key: 'storage_fridge', label: '냉장고' },
      { key: 'storage_hvac', label: '냉/난방기 작동' },
    ],
  },
]

export const ALL_FACILITY_CHECK_ITEMS: FacilityCheckItem[] =
  FACILITY_CHECK_CATEGORIES.flatMap((cat) => cat.items)

// ========================================
// 장비 점검 항목
// ========================================

export interface EquipmentCheckComponent {
  key: string
  label: string
}

export interface InspectionEquipment {
  key: string
  label: string
  components: EquipmentCheckComponent[]
}

const FIVE_COMPONENTS: EquipmentCheckComponent[] = [
  { key: 'camera_body', label: '소니 카메라 바디' },
  { key: 'lens', label: '카메라 렌즈' },
  { key: 'computer_monitor', label: '컴퓨터 및 모니터' },
  { key: 'led_light', label: '내부 LED 조명' },
  { key: 'motor', label: '내부 전동기' },
]

const FOUR_COMPONENTS: EquipmentCheckComponent[] = [
  { key: 'camera_body', label: '소니 카메라 바디' },
  { key: 'lens', label: '카메라 렌즈' },
  { key: 'led_light', label: '내부 LED 조명' },
  { key: 'computer_monitor', label: '컴퓨터 및 모니터' },
]

export const INSPECTION_EQUIPMENT: InspectionEquipment[] = [
  { key: 'xxl', label: '알파스튜디오 XXL', components: FIVE_COMPONENTS },
  { key: 'xl_pro', label: '알파샷 XL PRO', components: FIVE_COMPONENTS },
  { key: 'table', label: '알파테이블', components: FOUR_COMPONENTS },
  { key: 'desk', label: '알파데스크', components: FOUR_COMPONENTS },
  { key: 'compact', label: '알파스튜디오 컴팩트', components: FIVE_COMPONENTS },
  { key: '360', label: '알파샷 360', components: FIVE_COMPONENTS },
  { key: 'micro', label: '알파샷 마이크로', components: FIVE_COMPONENTS },
]

export const EQUIPMENT_CHECK_CRITERIA = '수량 및 작동 확인'
