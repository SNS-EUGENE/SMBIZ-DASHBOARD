import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { api } from '../lib/supabase'
import { useToast } from './Toast'

const EQUIPMENT_TYPES = ['AS360', 'MICRO', 'XL', 'XXL', '알파데스크', '알파테이블', 'Compact']

const ReservationForm = ({ reservation, defaultDate, onSave, onCancel }) => {
  const toast = useToast()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
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
    fetchCompanies()
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

  const fetchCompanies = async () => {
    const { data } = await api.companies.getAll()
    setCompanies(data || [])
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleEquipmentToggle = (equipment) => {
    setFormData(prev => ({
      ...prev,
      equipment_types: prev.equipment_types.includes(equipment)
        ? prev.equipment_types.filter(e => e !== equipment)
        : [...prev.equipment_types, equipment]
    }))
  }

  const handleSubmit = async (e) => {
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

    setLoading(true)

    try {
      if (reservation?.id) {
        // Update
        const { error } = await api.reservations.update(reservation.id, {
          company_id: formData.company_id,
          reservation_date: formData.reservation_date,
          time_slot: formData.time_slot,
          attendees: parseInt(formData.attendees),
          status: formData.status,
          work_2d: parseInt(formData.work_2d) || 0,
          work_3d: parseInt(formData.work_3d) || 0,
          work_video: parseInt(formData.work_video) || 0,
          is_training: formData.is_training,
          is_seminar: formData.is_seminar,
          notes: formData.notes,
        })

        if (error) throw error
      } else {
        // Create - need to get equipment IDs
        const { data: equipmentList } = await api.equipment.getAll()
        const equipmentIds = equipmentList
          .filter(eq => formData.equipment_types.includes(eq.type))
          .map(eq => eq.id)

        const { error } = await api.reservations.create({
          company_id: formData.company_id,
          reservation_date: formData.reservation_date,
          time_slot: formData.time_slot,
          attendees: parseInt(formData.attendees),
          status: formData.status,
          work_2d: parseInt(formData.work_2d) || 0,
          work_3d: parseInt(formData.work_3d) || 0,
          work_video: parseInt(formData.work_video) || 0,
          is_training: formData.is_training,
          is_seminar: formData.is_seminar,
          notes: formData.notes,
        }, equipmentIds)

        if (error) throw error
      }

      toast.success(reservation?.id ? '예약이 수정되었습니다.' : '예약이 추가되었습니다.')
      onSave()
    } catch (error) {
      toast.error('저장 실패: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
          </select>
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

      {/* 버튼 */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost"
          disabled={loading}
        >
          취소
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? '저장 중...' : (reservation?.id ? '수정' : '추가')}
        </button>
      </div>
    </form>
  )
}

export default ReservationForm
