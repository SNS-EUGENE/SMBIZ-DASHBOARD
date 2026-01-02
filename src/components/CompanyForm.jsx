import { useState, useEffect } from 'react'
import { api } from '../lib/supabase'
import { useToast } from './Toast'

const DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
  '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
  '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
]

const INDUSTRIES = [
  '제조업', '도소매업', 'IT/소프트웨어', '서비스업', '건설업', '교육업',
  '음식/숙박업', '금융/보험업', '부동산업', '예술/스포츠/여가',
  '전자상거래', '콘텐츠제작', '디자인', '광고/마케팅', '컨설팅',
  '기타업종', '기타'
]

const CompanyForm = ({ company, onSave, onCancel }) => {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    representative: '',
    business_number: '',
    industry: '',
    contact: '',
    email: '',
    district: '',
    address: '',
    notes: '',
  })

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        representative: company.representative || '',
        business_number: company.business_number || '',
        industry: company.industry || '',
        contact: company.contact || '',
        email: company.email || '',
        district: company.district || '',
        address: company.address || '',
        notes: company.notes || '',
      })
    }
  }, [company])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const formatBusinessNumber = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`
  }

  const handleBusinessNumberChange = (e) => {
    const formatted = formatBusinessNumber(e.target.value)
    setFormData(prev => ({
      ...prev,
      business_number: formatted
    }))
  }

  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
  }

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value)
    setFormData(prev => ({
      ...prev,
      contact: formatted
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.warning('기업명을 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      if (company?.id) {
        const { error } = await api.companies.update(company.id, formData)
        if (error) throw error
      } else {
        const { error } = await api.companies.create(formData)
        if (error) throw error
      }

      toast.success(company?.id ? '기업 정보가 수정되었습니다.' : '기업이 추가되었습니다.')
      onSave()
    } catch (error) {
      toast.error('저장 실패: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* 기업명 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          기업명 *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="input w-full"
          placeholder="주식회사 OOO"
          required
        />
      </div>

      {/* 대표자 및 사업자번호 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            대표자
          </label>
          <input
            type="text"
            name="representative"
            value={formData.representative}
            onChange={handleChange}
            className="input w-full"
            placeholder="홍길동"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            사업자번호
          </label>
          <input
            type="text"
            name="business_number"
            value={formData.business_number}
            onChange={handleBusinessNumberChange}
            className="input w-full"
            placeholder="123-45-67890"
            maxLength={12}
          />
        </div>
      </div>

      {/* 업종 및 자치구 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            업종
          </label>
          <select
            name="industry"
            value={formData.industry}
            onChange={handleChange}
            className="input w-full"
          >
            <option value="">업종 선택</option>
            {/* 기존값이 목록에 없으면 별도로 표시 */}
            {formData.industry && !INDUSTRIES.includes(formData.industry) && (
              <option value={formData.industry}>{formData.industry}</option>
            )}
            {INDUSTRIES.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            자치구
          </label>
          <select
            name="district"
            value={formData.district}
            onChange={handleChange}
            className="input w-full"
          >
            <option value="">자치구 선택</option>
            {DISTRICTS.map(dist => (
              <option key={dist} value={dist}>{dist}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 연락처 및 이메일 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            연락처
          </label>
          <input
            type="tel"
            name="contact"
            value={formData.contact}
            onChange={handlePhoneChange}
            className="input w-full"
            placeholder="010-1234-5678"
            maxLength={13}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            이메일
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="input w-full"
            placeholder="example@company.com"
          />
        </div>
      </div>

      {/* 주소 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          주소
        </label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="input w-full"
          placeholder="서울시 OO구 OO로 123"
        />
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
          {loading ? '저장 중...' : (company?.id ? '수정' : '추가')}
        </button>
      </div>
    </form>
  )
}

export default CompanyForm
