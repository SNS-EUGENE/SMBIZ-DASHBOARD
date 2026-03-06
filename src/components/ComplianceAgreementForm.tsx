import { useState, useRef, useEffect, type FormEvent, type ReactElement } from 'react'
import { api } from '../lib/supabase'
import { useToast } from './Toast'
import SignaturePad, { type SignaturePadHandle } from './SignaturePad'
import { generateCompliancePdf } from '../lib/compliancePdf'
import type { ComplianceAgreement } from '../types'

// ── 준수사항 조항 ────────────────────────────────────────

const COMPLIANCE_ARTICLES = [
  '이용자는 디지털콘텐츠제작실 활성화를 위하여 디지털콘텐츠제작실 이용 결과 도출된 사항(촬영장수, 제품정보)에 대한 자료를 제출해야 하며, 제출한 정보는 디지털콘텐츠제작실 홍보 목적으로 사용될 수 있다.',
  '이용자는 서비스 이용 중 시설 또는 장비 등 디지털콘텐츠제작실 자산을 사용함에 있어 신의성실 원칙에 입각한 주의의무를 다하여야 한다.',
  '이용자는 이용기간 중 디지털콘텐츠제작실 운영요령을 준수해야 하며 이를 준수하지 않을 경우 진흥원은 시정 요구 또는 이용제한 등 적절한 조치를 취할 수 있다.',
  '이용자는 디지털콘텐츠제작실 시설의 방재관리에 관한 다음 각 호의 사항을 준수하여야 한다.\n  ① 장비 및 냉방시스템 전원 및 소등 관리 등에 주의한다.\n  ② 디지털콘텐츠제작실 내에서는 소각행위를 할 수 없다.\n  ③ 소방법에 따라 피난시설 방화구획 및 방화시설의 주위에 물건을 쌓아두거나 장애물을 설치할 수 없다.\n  ④ 방재시설에 이상이 있을 때에는 즉시 신고하여야 한다.\n  ⑤ 기타 방재관리에 필요한 사항을 준수하여야 한다.',
  '이용자는 디지털콘텐츠제작실 이용 종료 시 시설물의 해체, 원상회복은 물론 부착물이나 쓰레기 등을 수거하여야 한다.',
  '이용자는 진흥원의 승인 없이 그 권리를 제3자에게 양도 또는 전대할 수 없다.',
  '이용자는 시설이용에 필요한 각종 광고 및 홍보물 설치 시 진흥원과 사전 협의하여야 한다.',
  '이용자의 고의 또는 과실, 주의의무를 태만히 하여 사고 또는 재해가 발생하는 경우 이용자는 민사상 손해 배상의 의무를 진다.',
  '이용자의 귀책사유로 인하여 디지털콘텐츠제작실 장비가 분실, 훼손, 멸실된 경우 동일하거나 동등한 수준의 규격을 갖춘 장비 실물 신품으로 배상하여야 한다.',
]

const ARTICLE_NUMBERS = ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.']

// ── Props ────────────────────────────────────────────────

interface ComplianceAgreementFormProps {
  reservationId: string
  /** 자동 채울 기업명 */
  companyName?: string
  /** 자동 채울 신청자명 */
  applicantName?: string
  /** 자동 채울 날짜 (YYYY-MM-DD) */
  date?: string
  /** 제출 완료 콜백 */
  onSubmitted?: () => void
  /** 읽기 전용 모드 (이미 제출된 동의서 조회) */
  existingAgreement?: ComplianceAgreement | null
  /** PDF 다운로드 버튼 숨김 (외부 페이지용) */
  hidePdfDownload?: boolean
}

// ── 컴포넌트 ─────────────────────────────────────────────

const ComplianceAgreementForm = ({
  reservationId,
  companyName = '',
  applicantName = '',
  date,
  onSubmitted,
  existingAgreement,
  hidePdfDownload,
}: ComplianceAgreementFormProps): ReactElement => {
  const toast = useToast()
  const sigPadRef = useRef<SignaturePadHandle>(null)

  const today = date || new Date().toISOString().slice(0, 10)
  const [year, month, day] = today.split('-')

  const [agreed, setAgreed] = useState(existingAgreement?.agreed ?? false)
  const [company, setCompany] = useState(existingAgreement?.company_name || companyName)
  const [applicant, setApplicant] = useState(existingAgreement?.applicant_name || applicantName)
  const [submitting, setSubmitting] = useState(false)
  const [hasSigned, setHasSigned] = useState(!!existingAgreement?.signature_data)

  // 읽기 전용 모드
  const isReadOnly = !!existingAgreement

  useEffect(() => {
    if (companyName && !existingAgreement) setCompany(companyName)
  }, [companyName, existingAgreement])

  useEffect(() => {
    if (applicantName && !existingAgreement) setApplicant(applicantName)
  }, [applicantName, existingAgreement])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!agreed) {
      toast.warning('이용자 준수사항에 동의해주세요.')
      return
    }
    if (!company.trim()) {
      toast.warning('신청 기업명을 입력해주세요.')
      return
    }
    if (!applicant.trim()) {
      toast.warning('신청자명을 입력해주세요.')
      return
    }
    if (sigPadRef.current?.isEmpty()) {
      toast.warning('서명을 해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const signatureData = sigPadRef.current?.toDataURL() || null

      const { error } = await api.compliance.submit({
        reservation_id: reservationId,
        agreed: true,
        signed_date: today,
        company_name: company.trim(),
        applicant_name: applicant.trim(),
        signature_data: signatureData,
      })

      if (error) {
        toast.error('동의서 제출 실패 : ' + error.message)
      } else {
        toast.success('이용자 준수사항 동의가 완료되었습니다.')
        onSubmitted?.()
      }
    } catch (err) {
      toast.error('오류가 발생했습니다 : ' + (err instanceof Error ? err.message : 'Unknown'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearSignature = () => {
    sigPadRef.current?.clear()
    setHasSigned(false)
  }

  const handleDownloadPdf = async () => {
    try {
      const signatureData = existingAgreement?.signature_data || sigPadRef.current?.toDataURL() || null
      await generateCompliancePdf({
        agreed,
        year,
        month,
        day,
        companyName: company,
        applicantName: applicant,
        signatureData,
      })
      toast.success('PDF가 다운로드되었습니다.')
    } catch (err) {
      toast.error('PDF 생성 실패 : ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 준수사항 조항 */}
      <div className="card p-4 max-h-[320px] overflow-y-auto">
        <h3 className="text-sm font-bold text-text-primary mb-3 text-center">
          디지털 콘텐츠 제작실 이용자 준수사항
        </h3>
        <div className="space-y-3">
          {COMPLIANCE_ARTICLES.map((article, i) => (
            <div key={i} className="flex gap-2 text-xs leading-relaxed text-text-secondary">
              <span className="text-text-tertiary flex-shrink-0 font-medium">
                {ARTICLE_NUMBERS[i]}
              </span>
              <span className="whitespace-pre-wrap">{article}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 동의 체크박스 */}
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border/50 bg-bg-tertiary/20 hover:bg-bg-tertiary/40 transition">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => !isReadOnly && setAgreed(e.target.checked)}
          disabled={isReadOnly}
          className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
        />
        <span className="text-sm text-text-primary font-medium">
          위 이용자 준수사항에 동의합니다.
        </span>
      </label>

      {/* 날짜 */}
      <p className="text-sm text-text-secondary text-center tabular-nums">
        {year}년 {month}월 {day}일
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-text-tertiary mb-1 block">신청 기업</label>
          <input
            type="text"
            value={company}
            onChange={(e) => !isReadOnly && setCompany(e.target.value)}
            disabled={isReadOnly}
            className="input w-full text-sm py-1.5"
            placeholder="기업명"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-tertiary mb-1 block">신청자</label>
          <input
            type="text"
            value={applicant}
            onChange={(e) => !isReadOnly && setApplicant(e.target.value)}
            disabled={isReadOnly}
            className="input w-full text-sm py-1.5"
            placeholder="이름"
          />
        </div>
      </div>

      {/* 서명 패드 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-text-tertiary">신청자 서명</label>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleClearSignature}
              className="text-[10px] text-text-tertiary hover:text-text-secondary transition"
            >
              지우기
            </button>
          )}
        </div>
        {isReadOnly && existingAgreement?.signature_data ? (
          <div className="rounded-lg border border-border bg-bg-tertiary/30 p-4 flex items-center justify-center">
            <img
              src={existingAgreement.signature_data}
              alt="서명"
              className="max-h-[120px] opacity-90"
            />
          </div>
        ) : (
          <SignaturePad
            ref={sigPadRef}
            onEnd={() => setHasSigned(true)}
            height={140}
          />
        )}
      </div>

      {/* 버튼 */}
      <div className="flex gap-2">
        {!isReadOnly && (
          <button
            type="submit"
            disabled={submitting || !agreed || !hasSigned}
            className="btn btn-primary flex-1"
          >
            {submitting ? '제출 중...' : '동의 제출'}
          </button>
        )}
        {!hidePdfDownload && (isReadOnly || hasSigned) && (
          <button
            type="button"
            onClick={handleDownloadPdf}
            className={`btn btn-ghost flex items-center justify-center gap-1.5 ${isReadOnly ? 'flex-1' : ''}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PDF 다운로드
          </button>
        )}
      </div>
    </form>
  )
}

export default ComplianceAgreementForm
