import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  SATISFACTION_LEVELS,
  SURVEY_CATEGORIES,
  STUDIO_REFERRAL_OPTIONS,
  STUDIO_BENEFIT_OPTIONS,
} from '../constants/survey'
import { api } from '../lib/supabase'
import { useToast } from './Toast'
import { notifySurveyCompleted } from '../lib/notifications'
import type { SatisfactionSurvey, SurveyCategoryRatings } from '../types'

interface SurveyReservationOption {
  reservationId: string
  label: string
  survey: SatisfactionSurvey | null
  // 알림용 메타데이터 (optional — 없어도 동작)
  reservationDate?: string
  timeSlot?: string
  companyName?: string
  equipment?: string[]
}

interface SurveySubmissionFormProps {
  options: SurveyReservationOption[]
  surveyTableNotConfigured: boolean
  onSubmitted: () => Promise<void> | void
  /** 임베디드 모드: 카드 래퍼, 제목, 제출 버튼 없이 폼만 렌더링 */
  embedded?: boolean
  /** 폼 요소의 id (외부 submit 버튼에서 form= 속성으로 연결) */
  formId?: string
  /** submitting 상태 변경 시 콜백 (외부 버튼 disabled 처리용) */
  onSubmittingChange?: (submitting: boolean) => void
}

interface FormData {
  category_ratings: SurveyCategoryRatings
  studio_referral: string[]
  studio_referral_other: string
  benefits: string[]
  comment: string
}

const INITIAL_FORM: FormData = {
  category_ratings: {},
  studio_referral: [],
  studio_referral_other: '',
  benefits: [],
  comment: '',
}

function parseExistingSurvey(survey: SatisfactionSurvey): Partial<FormData> {
  const result: Partial<FormData> = {
    category_ratings: survey.category_ratings || {},
    comment: survey.comment || '',
  }

  if (survey.improvement_request) {
    try {
      const parsed = JSON.parse(survey.improvement_request) as Record<string, unknown>
      // 하위호환: string → string[]
      if (parsed.studio_referral) {
        result.studio_referral = Array.isArray(parsed.studio_referral)
          ? parsed.studio_referral as string[]
          : [parsed.studio_referral as string]
      }
      if (parsed.studio_referral_other) {
        result.studio_referral_other = parsed.studio_referral_other as string
      }
      if (parsed.benefits) {
        result.benefits = Array.isArray(parsed.benefits)
          ? parsed.benefits as string[]
          : [parsed.benefits as string]
      }
    } catch {
      // 레거시 JSON 또는 plain text → 무시
    }
  }

  return result
}

const SurveySubmissionForm = ({
  options,
  surveyTableNotConfigured,
  onSubmitted,
  embedded = false,
  formId,
  onSubmittingChange,
}: SurveySubmissionFormProps) => {
  const toast = useToast()

  const [selectedReservationId, setSelectedReservationId] = useState('')
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 외부에 submitting 상태 전달
  useEffect(() => {
    onSubmittingChange?.(submitting)
  }, [submitting, onSubmittingChange])

  const optionMap = useMemo(() => {
    const map = new Map<string, SurveyReservationOption>()
    options.forEach((o) => map.set(o.reservationId, o))
    return map
  }, [options])

  const selectedOption = optionMap.get(selectedReservationId)
  const hasOptions = options.length > 0

  useEffect(() => {
    if (!hasOptions) { setSelectedReservationId(''); return }
    if (!selectedReservationId || !optionMap.has(selectedReservationId)) {
      setSelectedReservationId(options[0].reservationId)
    }
  }, [hasOptions, optionMap, options, selectedReservationId])

  useEffect(() => {
    if (!selectedReservationId) return
    const current = optionMap.get(selectedReservationId)

    if (!current?.survey) {
      setFormData(INITIAL_FORM)
      setPrivacyConsentChecked(false)
      setErrorMessage(null)
      return
    }

    const parsed = parseExistingSurvey(current.survey)
    setFormData({ ...INITIAL_FORM, ...parsed })
    setPrivacyConsentChecked(current.survey.privacy_consent !== 'N')
    setErrorMessage(null)
  }, [selectedReservationId, optionMap])

  const setRating = (key: string, value: number) => {
    setFormData((prev) => ({
      ...prev,
      category_ratings: { ...prev.category_ratings, [key]: value },
    }))
  }

  const toggleReferral = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      studio_referral: prev.studio_referral.includes(value)
        ? prev.studio_referral.filter((v) => v !== value)
        : [...prev.studio_referral, value],
      // 기타 해제 시 텍스트도 초기화
      ...(value === '기타' && prev.studio_referral.includes('기타') ? { studio_referral_other: '' } : {}),
    }))
  }

  const toggleBenefit = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      benefits: prev.benefits.includes(value)
        ? prev.benefits.filter((v) => v !== value)
        : [...prev.benefits, value],
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!selectedReservationId) {
      setErrorMessage('예약 건을 선택해주세요.')
      return
    }

    const unanswered = SURVEY_CATEGORIES.filter(
      (cat) => !formData.category_ratings[cat.key]
    )
    if (unanswered.length > 0) {
      setErrorMessage('모든 만족도 항목을 선택해주세요.')
      return
    }

    if (formData.studio_referral.length === 0) {
      setErrorMessage('스튜디오 경로를 1개 이상 선택해주세요.')
      return
    }

    if (formData.studio_referral.includes('기타') && !formData.studio_referral_other.trim()) {
      setErrorMessage('기타 경로를 입력해주세요.')
      return
    }

    if (formData.benefits.length === 0) {
      setErrorMessage('도움이 된 부분을 1개 이상 선택해주세요.')
      return
    }

    if (!privacyConsentChecked) {
      setErrorMessage('개인정보 수집 및 이용 동의가 필요합니다.')
      return
    }

    setSubmitting(true)

    // 6개 평점 평균으로 overall_rating 계산
    const ratingValues = SURVEY_CATEGORIES.map(
      (cat) => formData.category_ratings[cat.key] || 0
    )
    const averageRating = Math.round(
      ratingValues.reduce((sum, v) => sum + v, 0) / ratingValues.length
    )

    const improvementPayload: Record<string, unknown> = {
      studio_referral: formData.studio_referral,
      benefits: formData.benefits,
    }
    if (formData.studio_referral_other.trim()) {
      improvementPayload.studio_referral_other = formData.studio_referral_other.trim()
    }
    const improvementData = JSON.stringify(improvementPayload)

    const result = await api.surveys.submit({
      reservation_id: selectedReservationId,
      overall_rating: averageRating,
      category_ratings: formData.category_ratings,
      comment: formData.comment.trim() || null,
      improvement_request: improvementData,
      privacy_consent: 'Y',
    })

    if (result.notConfigured) {
      setErrorMessage('만족도 조사 테이블이 연결되지 않았습니다.')
      setSubmitting(false)
      return
    }
    if (result.error) {
      setErrorMessage(`설문 저장 실패 : ${result.error.message}`)
      setSubmitting(false)
      return
    }

    const alreadySubmitted = Boolean(selectedOption?.survey?.submitted_at)
    toast.success(alreadySubmitted ? '만족도 조사를 수정했습니다.' : '만족도 조사를 제출했습니다.')

    // 카카오워크 알림 (신규 제출 시에만)
    if (!alreadySubmitted && selectedOption?.companyName) {
      const avgRating = ratingValues.reduce((s, v) => s + v, 0) / ratingValues.length
      notifySurveyCompleted({
        date: selectedOption.reservationDate || '',
        timeSlot: selectedOption.timeSlot || '',
        equipment: selectedOption.equipment || [],
        companyName: selectedOption.companyName,
        averageRating: avgRating,
      })
    }

    await onSubmitted()
    setSubmitting(false)
  }

  const disabled = submitting || surveyTableNotConfigured || !hasOptions

  const formContent = (
    <>
      {/* 대상 예약 선택 — embedded에서는 숨김 (부모에서 표시) */}
      {!embedded && (
        <div className="space-y-2">
          <label htmlFor="survey-reservation" className="text-xs text-text-tertiary">대상 예약</label>
          <select
            id="survey-reservation"
            value={selectedReservationId}
            onChange={(e) => setSelectedReservationId(e.target.value)}
            className="input w-full"
            disabled={disabled}
          >
            {options.map((o) => (
              <option key={o.reservationId} value={o.reservationId}>{o.label}</option>
            ))}
          </select>
          {selectedOption?.survey?.submitted_at && (
            <p className="text-xs text-text-tertiary">
              기존 제출 건입니다. 수정 후 다시 제출하면 최신 내용으로 갱신됩니다.
            </p>
          )}
        </div>
      )}

        {/* Q1-Q6: 항목별 만족도 평점 */}
        {SURVEY_CATEGORIES.map((cat, idx) => (
          <div key={cat.key} className="rounded-lg border border-border/70 bg-bg-tertiary/20 p-4 space-y-3">
            <div className="text-sm text-text-primary">
              {idx + 1}. {cat.label} <span className="text-danger">*</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SATISFACTION_LEVELS.map((level) => {
                const active = formData.category_ratings[cat.key] === level.value
                let colorClass = 'bg-bg-secondary text-text-secondary border-border hover:text-text-primary'
                if (active) {
                  if (level.value >= 4) colorClass = 'bg-success/80 text-white border-success'
                  else if (level.value === 3) colorClass = 'bg-warning/80 text-black border-warning'
                  else colorClass = 'bg-danger/80 text-white border-danger'
                }
                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setRating(cat.key, level.value)}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded-md text-xs border transition ${colorClass}`}
                  >
                    {level.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Q7: 스튜디오 경로 (다중선택) */}
        <div className="rounded-lg border border-border/70 bg-bg-tertiary/20 p-4 space-y-3">
          <div className="text-sm text-text-primary">
            7. 스튜디오를 알게 된 경로를 선택해주세요. (복수 선택 가능) <span className="text-danger">*</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {STUDIO_REFERRAL_OPTIONS.map((opt) => {
              const active = formData.studio_referral.includes(opt.value)
              const colorClass = active
                ? 'bg-primary/80 text-white border-primary'
                : 'bg-bg-secondary text-text-secondary border-border hover:text-text-primary'
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleReferral(opt.value)}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-md text-xs border transition ${colorClass}`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {formData.studio_referral.includes('기타') && (
            <input
              type="text"
              value={formData.studio_referral_other}
              onChange={(e) => setFormData((p) => ({ ...p, studio_referral_other: e.target.value }))}
              placeholder="기타 경로를 입력해주세요"
              className="input w-full text-sm"
              disabled={disabled}
            />
          )}
        </div>

        {/* Q8: 도움이 된 부분 (다중선택) */}
        <div className="rounded-lg border border-border/70 bg-bg-tertiary/20 p-4 space-y-3">
          <div className="text-sm text-text-primary">
            8. 제작실 이용을 통해 도움이 된 부분을 선택해주세요. (복수 선택 가능) <span className="text-danger">*</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {STUDIO_BENEFIT_OPTIONS.map((opt) => {
              const active = formData.benefits.includes(opt.value)
              const colorClass = active
                ? 'bg-primary/80 text-white border-primary'
                : 'bg-bg-secondary text-text-secondary border-border hover:text-text-primary'
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleBenefit(opt.value)}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-md text-xs border transition ${colorClass}`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Q9: 기타 의견 (선택) */}
        <div className="rounded-lg border border-border/70 bg-bg-tertiary/20 p-4 space-y-3">
          <div className="text-sm text-text-primary">
            9. 기타 바라는 점이나 개선이 필요한 사항이 있다면 자유롭게 작성해주세요.
          </div>
          <textarea
            value={formData.comment}
            onChange={(e) => setFormData((p) => ({ ...p, comment: e.target.value }))}
            placeholder="개선사항, 건의사항 등 자유롭게 작성해주세요."
            className="input w-full resize-y min-h-[90px] text-sm"
            rows={3}
            disabled={disabled}
          />
        </div>

        {/* 개인정보 동의 */}
        <div className="rounded-lg border border-border bg-bg-tertiary/20 px-3 py-2">
          <label className="inline-flex items-start gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 rounded border-border bg-bg-tertiary"
              checked={privacyConsentChecked}
              onChange={(e) => setPrivacyConsentChecked(e.target.checked)}
              disabled={disabled}
            />
            <span>개인정보 수집 및 이용에 동의합니다. (동의 시 제출 가능)</span>
          </label>
        </div>

      {errorMessage && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm p-3">
          {errorMessage}
        </div>
      )}

      {/* 독립 모드에서만 제출 버튼 표시 */}
      {!embedded && (
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={submitting || surveyTableNotConfigured || !hasOptions || !privacyConsentChecked}
        >
          {submitting ? '제출 중...' : '만족도조사 제출'}
        </button>
      )}
    </>
  )

  // 임베디드 모드: 래퍼 없이 폼만
  if (embedded) {
    return (
      <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
        {surveyTableNotConfigured && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 text-warning text-sm p-3">
            satisfaction_surveys 테이블이 연결되지 않아 제출할 수 없습니다.
          </div>
        )}
        {formContent}
      </form>
    )
  }

  // 독립 모드: 카드 래퍼 + 제목 포함
  return (
    <div className="card p-5">
      <h4 className="text-sm font-semibold text-text-primary mb-4">만족도조사 입력</h4>

      {surveyTableNotConfigured && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 text-warning text-sm p-3">
          satisfaction_surveys 테이블이 연결되지 않아 제출할 수 없습니다.
        </div>
      )}

      {!hasOptions && (
        <div className="mb-4 rounded-lg border border-border bg-bg-tertiary/40 text-text-secondary text-sm p-3">
          선택 가능한 예약 데이터가 없습니다.
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {formContent}
      </form>
    </div>
  )
}

export type { SurveyReservationOption }
export default SurveySubmissionForm
