import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { format } from 'date-fns'
import { api } from '../lib/supabase'
import { useToast } from './Toast'
import Modal from './Modal'
import { EQUIPMENT_TYPES } from '../constants'
import { notifyReservationCreated, notifyReservationUpdated } from '../lib/notifications'
import type { ReservationWithDetails, Company } from '../types'

// ========================================
// Interfaces
// ========================================

interface PastedCompanyData {
  name: string
  representative?: string
  businessNumber?: string
  industry?: string
  contact?: string
}

interface PastedReservationData {
  date?: string
  timeSlot?: string
  equipment?: string[]
  work2d?: number
  work3d?: number
  workVideo?: number
}

interface PastedData {
  _type: string
  reservation: PastedReservationData
  company: PastedCompanyData
  notes?: string
}

interface FormData {
  company_id: string
  reservation_date: string
  time_slot: string
  attendees: number
  status: string
  equipment_types: string[]
  work_2d: number
  work_3d: number
  work_video: number
  is_training: boolean
  is_seminar: boolean
  notes: string
}

interface ReservationFormProps {
  reservation?: ReservationWithDetails | null
  defaultDate?: Date
  onSave: () => void
  onLoadingChange?: (loading: boolean) => void
}

const FORM_ID = 'reservation-form'

export interface ReservationFormHandle {
  pasteFromClipboard: () => void
}

// ========================================
// Helper Functions
// ========================================

/** 에러 객체에서 메시지 추출 (Supabase PostgrestError 포함) */
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: string }).message)
  }
  return 'Unknown error'
}

// 붙여넣기 데이터 파싱 함수
const parsePastedData = (text: string): PastedData | null => {
  try {
    const data = JSON.parse(text)
    // SMBIZ 데이터 형식 확인
    if (data._type === 'SMBIZ_RESERVATION_DATA') {
      return data as PastedData
    }
    return null
  } catch {
    return null
  }
}

// ========================================
// Component
// ========================================

const ReservationForm = forwardRef<ReservationFormHandle, ReservationFormProps>(({ reservation, defaultDate, onSave, onLoadingChange }, ref) => {
  const toast = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const updateLoading = (value: boolean) => { setLoading(value); onLoadingChange?.(value) }
  const [pastedCompanyData, setPastedCompanyData] = useState<PastedCompanyData | null>(null)
  const [showNewCompanyModal, setShowNewCompanyModal] = useState<boolean>(false)
  const [creatingCompany, setCreatingCompany] = useState<boolean>(false)
  const [formData, setFormData] = useState<FormData>({
    company_id: '',
    reservation_date: '',
    time_slot: 'morning',
    attendees: 1,
    status: 'confirmed',
    equipment_types: [],
    work_2d: 0,
    work_3d: 0,
    work_video: 0,
    is_training: false,
    is_seminar: false,
    notes: '',
  })

  useEffect(() => {
    const init = async () => {
      await fetchCompanies()
    }
    init()
  }, [])

  // reservation이 변경될 때 formData 설정 (companies 로딩과 별개로)
  useEffect(() => {
    if (reservation) {
      setFormData({
        company_id: reservation.company_id || '',
        reservation_date: reservation.reservation_date || '',
        time_slot: reservation.time_slot || 'morning',
        attendees: reservation.attendees || 1,
        status: reservation.status || 'confirmed',
        equipment_types: reservation.equipment_types || [],
        work_2d: reservation.work_2d || 0,
        work_3d: reservation.work_3d || 0,
        work_video: reservation.work_video || 0,
        is_training: reservation.is_training || false,
        is_seminar: reservation.is_seminar || false,
        notes: reservation.notes || '',
      })
    } else if (defaultDate) {
      setFormData(prev => ({
        ...prev,
        reservation_date: format(defaultDate, 'yyyy-MM-dd')
      }))
    }
  }, [reservation, defaultDate])

  const fetchCompanies = async (): Promise<void> => {
    const { data, error } = await api.companies.getAll()
    if (error) {
      toast.error('기업 목록 조회 실패 : ' + error.message)
    }
    setCompanies(data || [])
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleEquipmentToggle = (equipment: string): void => {
    setFormData(prev => ({
      ...prev,
      equipment_types: prev.equipment_types.includes(equipment)
        ? prev.equipment_types.filter(e => e !== equipment)
        : [...prev.equipment_types, equipment]
    }))
  }

  // 클립보드에서 데이터 읽기 (버튼 클릭)
  const handlePasteFromClipboard = useCallback(async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast.warning('클립보드가 비어있습니다.')
        return
      }

      const parsed = parsePastedData(text)
      if (!parsed) {
        toast.warning('SMBIZ 데이터 형식이 아닙니다. 크롬 익스텐션에서 복사해주세요.')
        return
      }

      toast.info('SMBIZ 데이터를 불러왔습니다.')

      // 예약 데이터 적용
      const { reservation: resData, company: compData, notes } = parsed

      setFormData(prev => ({
        ...prev,
        reservation_date: resData.date || prev.reservation_date,
        time_slot: resData.timeSlot || prev.time_slot,
        equipment_types: resData.equipment || prev.equipment_types,
        work_2d: resData.work2d || 0,
        work_3d: resData.work3d || 0,
        work_video: resData.workVideo || 0,
        notes: notes || prev.notes,
      }))

      // 기업 매칭 시도
      if (compData?.name) {
        // 1. 기업명으로 검색
        let matchedCompany = companies.find(c =>
          c.name === compData.name ||
          c.name.includes(compData.name) ||
          compData.name.includes(c.name)
        )

        // 2. 사업자등록번호로 검색
        if (!matchedCompany && compData.businessNumber) {
          matchedCompany = companies.find(c =>
            c.business_number === compData.businessNumber
          )
        }

        if (matchedCompany) {
          setFormData(prev => ({ ...prev, company_id: matchedCompany.id }))
          toast.success(`기업 "${matchedCompany.name}" 자동 선택됨`)
        } else {
          // 기업이 없으면 새로 등록할지 물어봄
          setPastedCompanyData(compData)
          setShowNewCompanyModal(true)
        }
      }
    } catch (error: unknown) {
      toast.error('클립보드 읽기 실패 : ' + getErrorMessage(error))
    }
  }, [companies, toast])

  useImperativeHandle(ref, () => ({ pasteFromClipboard: handlePasteFromClipboard }), [handlePasteFromClipboard])

  // 새 기업 등록
  const handleCreateNewCompany = async (): Promise<void> => {
    if (!pastedCompanyData) return

    setCreatingCompany(true)
    try {
      const newCompany = {
        name: pastedCompanyData.name,
        representative: pastedCompanyData.representative || '',
        business_number: pastedCompanyData.businessNumber || '',
        industry: pastedCompanyData.industry || '기타',
        contact: pastedCompanyData.contact || '',
        district: '',
      }

      const { data, error } = await api.companies.create(newCompany)
      if (error) throw error

      // 기업 목록 새로고침
      await fetchCompanies()

      // 새로 생성된 기업 선택
      setFormData(prev => ({ ...prev, company_id: data.id }))
      toast.success(`기업 "${newCompany.name}" 등록 완료`)
      setShowNewCompanyModal(false)
      setPastedCompanyData(null)
    } catch (error: unknown) {
      toast.error('기업 등록 실패 : ' + getErrorMessage(error))
    } finally {
      setCreatingCompany(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()

    if (!formData.company_id) {
      toast.warning('기업을 선택해주세요.')
      return
    }

    if (!formData.reservation_date) {
      toast.warning('예약 날짜를 선택해주세요.')
      return
    }

    if (formData.equipment_types.length === 0) {
      toast.warning('장비를 하나 이상 선택해주세요.')
      return
    }

    updateLoading(true)

    try {
      if (reservation?.id) {
        // Update - also update equipment mappings
        const { data: equipmentList, error: eqError } = await api.equipment.getAll()
        if (eqError || !equipmentList) throw eqError ?? new Error('장비 목록 조회 실패')
        const equipmentIds = equipmentList
          .filter((eq: { type: string }) => formData.equipment_types.includes(eq.type))
          .map((eq: { id: string }) => eq.id)

        const { error } = await api.reservations.update(reservation.id, {
          company_id: formData.company_id,
          reservation_date: formData.reservation_date,
          time_slot: formData.time_slot,
          attendees: parseInt(String(formData.attendees)),
          status: formData.status,
          work_2d: parseInt(String(formData.work_2d)) || 0,
          work_3d: parseInt(String(formData.work_3d)) || 0,
          work_video: parseInt(String(formData.work_video)) || 0,
          is_training: formData.is_training,
          is_seminar: formData.is_seminar,
          notes: formData.notes,
        }, null, equipmentIds)

        if (error) throw error
      } else {
        // Create - need to get equipment IDs
        const { data: equipmentList, error: eqError } = await api.equipment.getAll()
        if (eqError || !equipmentList) throw eqError ?? new Error('장비 목록 조회 실패')
        const equipmentIds = equipmentList
          .filter((eq: { type: string }) => formData.equipment_types.includes(eq.type))
          .map((eq: { id: string }) => eq.id)

        const { error } = await api.reservations.create({
          company_id: formData.company_id,
          reservation_date: formData.reservation_date,
          time_slot: formData.time_slot,
          attendees: parseInt(String(formData.attendees)),
          status: formData.status,
          work_2d: parseInt(String(formData.work_2d)) || 0,
          work_3d: parseInt(String(formData.work_3d)) || 0,
          work_video: parseInt(String(formData.work_video)) || 0,
          is_training: formData.is_training,
          is_seminar: formData.is_seminar,
          notes: formData.notes,
        }, equipmentIds)

        if (error) throw error
      }

      toast.success(reservation?.id ? '예약이 수정되었습니다.' : '예약이 추가되었습니다.')

      // 카카오워크 알림 (fire-and-forget)
      const selectedCompany = companies.find(c => c.id === formData.company_id)
      const notifyData = {
        date: formData.reservation_date,
        timeSlot: formData.time_slot,
        equipment: formData.equipment_types,
        companyName: selectedCompany?.name || '(미상)',
        applicantName: selectedCompany?.representative || '',
        contact: selectedCompany?.contact || '',
      }
      if (reservation?.id) {
        notifyReservationUpdated(notifyData)
      } else {
        notifyReservationCreated(notifyData)
      }

      onSave()
    } catch (error: unknown) {
      toast.error('저장 실패 : ' + getErrorMessage(error))
    } finally {
      updateLoading(false)
    }
  }

  return (
    <>
    <form id={FORM_ID} onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* 기업 선택 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          기업 선택 *
        </label>
        <select
          name="company_id"
          value={formData.company_id}
          onChange={handleChange}
          className="input w-full"
          required
        >
          <option value="">기업을 선택하세요</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>
              {company.name} ({company.representative})
            </option>
          ))}
        </select>
      </div>

      {/* 날짜 및 시간 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            예약 날짜 *
          </label>
          <input
            type="date"
            name="reservation_date"
            value={formData.reservation_date}
            onChange={handleChange}
            className="input w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            시간대 *
          </label>
          <select
            name="time_slot"
            value={formData.time_slot}
            onChange={handleChange}
            className="input w-full"
          >
            <option value="morning">오전 (09:00-13:00)</option>
            <option value="afternoon">오후 (14:00-18:00)</option>
          </select>
        </div>
      </div>

      {/* 장비 선택 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          장비 선택 *
        </label>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_TYPES.map(eq => (
            <button
              key={eq}
              type="button"
              onClick={() => handleEquipmentToggle(eq)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                formData.equipment_types.includes(eq)
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-bg-tertiary border-border text-text-secondary hover:border-border-hover'
              }`}
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      {/* 인원 및 상태 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            인원
          </label>
          <input
            type="number"
            name="attendees"
            value={formData.attendees}
            onChange={handleChange}
            min="1"
            max="20"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            상태
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="input w-full"
          >
            <option value="pending">대기</option>
            <option value="confirmed">확정</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
            <option value="no_show">노쇼</option>
          </select>
          {formData.status === 'no_show' && (
            <p className="text-xs text-warning mt-1">
              노쇼 처리 시 해당 기업은 1주일간 예약이 제한됩니다.
            </p>
          )}
        </div>
      </div>

      {/* 작업량 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          작업량
        </label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-text-tertiary mb-1">2D (장)</label>
            <input
              type="number"
              name="work_2d"
              value={formData.work_2d}
              onChange={handleChange}
              min="0"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">3D (장)</label>
            <input
              type="number"
              name="work_3d"
              value={formData.work_3d}
              onChange={handleChange}
              min="0"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-text-tertiary mb-1">영상 (건)</label>
            <input
              type="number"
              name="work_video"
              value={formData.work_video}
              onChange={handleChange}
              min="0"
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* 분류 */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="is_training"
            checked={formData.is_training}
            onChange={handleChange}
            className="w-4 h-4 rounded border-border bg-bg-tertiary"
          />
          <span className="text-sm text-text-secondary">교육</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="is_seminar"
            checked={formData.is_seminar}
            onChange={handleChange}
            className="w-4 h-4 rounded border-border bg-bg-tertiary"
          />
          <span className="text-sm text-text-secondary">세미나</span>
        </label>
      </div>

      {/* 비고 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          비고
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="input w-full resize-none"
          placeholder="추가 메모..."
        />
      </div>
    </form>

    {/* 새 기업 등록 모달 */}
    <Modal
      isOpen={showNewCompanyModal}
      onClose={() => {
        setShowNewCompanyModal(false)
        setPastedCompanyData(null)
      }}
      title="새 기업 등록"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => { setShowNewCompanyModal(false); setPastedCompanyData(null) }}
            className="btn btn-ghost"
            disabled={creatingCompany}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleCreateNewCompany}
            className="btn btn-primary"
            disabled={creatingCompany}
          >
            {creatingCompany ? '등록 중...' : '기업 등록'}
          </button>
        </div>
      }
    >
      <div className="p-6">
        <p className="text-sm text-text-secondary mb-4">
          기업 &ldquo;{pastedCompanyData?.name}&rdquo;이(가) 등록되어 있지 않습니다.
          새로 등록하시겠습니까?
        </p>

        {pastedCompanyData && (
          <div className="bg-bg-tertiary rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-tertiary">기업명</span>
              <span className="text-text-primary font-medium">{pastedCompanyData.name}</span>
            </div>
            {pastedCompanyData.representative && (
              <div className="flex justify-between">
                <span className="text-text-tertiary">대표자</span>
                <span className="text-text-primary">{pastedCompanyData.representative}</span>
              </div>
            )}
            {pastedCompanyData.businessNumber && (
              <div className="flex justify-between">
                <span className="text-text-tertiary">사업자번호</span>
                <span className="text-text-primary font-mono">{pastedCompanyData.businessNumber}</span>
              </div>
            )}
            {pastedCompanyData.industry && (
              <div className="flex justify-between">
                <span className="text-text-tertiary">업종</span>
                <span className="text-text-primary">{pastedCompanyData.industry}</span>
              </div>
            )}
            {pastedCompanyData.contact && (
              <div className="flex justify-between">
                <span className="text-text-tertiary">연락처</span>
                <span className="text-text-primary">{pastedCompanyData.contact}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
    </>
  )
})

ReservationForm.displayName = 'ReservationForm'

export { FORM_ID as RESERVATION_FORM_ID }
export default ReservationForm
