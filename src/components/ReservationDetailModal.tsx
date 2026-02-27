import { useState, useEffect, useMemo } from 'react'
import Modal from './Modal'
import SurveySubmissionForm, { type SurveyReservationOption } from './SurveySubmissionForm'
import { api } from '../lib/supabase'
import { RESERVATION_STATUS } from '../constants'
import { fmtNum } from '../lib/utils'
import type { SatisfactionSurvey } from '../types'
import { SURVEY_CATEGORY_LABELS, SATISFACTION_LEVEL_LABELS } from '../constants/survey'

interface ReservationDetail {
  id: string
  company_id: string
  reservation_date: string
  time_slot: string
  status: string
  attendees: number
  is_training: boolean
  is_seminar: boolean
  work_2d: number
  work_3d: number
  work_video: number
  notes: string | null
  company_name?: string
  industry?: string
  representative?: string
  contact?: string
  district?: string | null
  equipment_types: string[]
  // smbiz 스크래핑 필드
  reserve_idx?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  request_notes?: string | null
  business_license_url?: string | null
  small_biz_cert_url?: string | null
  // 기업 추가 정보
  business_number?: string | null
  company_size?: string | null
}

interface ReservationDetailModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: ReservationDetail | null
}

const ReservationDetailModal = ({ isOpen, onClose, reservation }: ReservationDetailModalProps) => {
  const [survey, setSurvey] = useState<SatisfactionSurvey | null>(null)
  const [surveyLoading, setSurveyLoading] = useState(false)
  const [surveyNotConfigured, setSurveyNotConfigured] = useState(false)
  const [activeTab, setActiveTab] = useState<'detail' | 'survey'>('detail')

  useEffect(() => {
    if (!isOpen || !reservation) {
      setSurvey(null)
      setActiveTab('detail')
      return
    }

    const fetchSurvey = async () => {
      setSurveyLoading(true)
      const result = await api.surveys.getByReservationIds([reservation.id])
      if (result.notConfigured) {
        setSurveyNotConfigured(true)
      } else if (result.data && result.data.length > 0) {
        setSurvey(result.data[0])
      } else {
        setSurvey(null)
      }
      setSurveyLoading(false)
    }

    fetchSurvey()
  }, [isOpen, reservation])

  const surveyOptions: SurveyReservationOption[] = useMemo(() => {
    if (!reservation) return []
    return [{
      reservationId: reservation.id,
      label: `${reservation.reservation_date} · ${reservation.time_slot === 'morning' ? '오전' : '오후'} · ${reservation.company_name || ''}`,
      survey,
      reservationDate: reservation.reservation_date,
      timeSlot: reservation.time_slot,
      companyName: reservation.company_name || '',
      equipment: reservation.equipment_types || [],
    }]
  }, [reservation, survey])

  const handleSurveySubmitted = async () => {
    if (!reservation) return
    const result = await api.surveys.getByReservationIds([reservation.id])
    if (result.data && result.data.length > 0) {
      setSurvey(result.data[0])
    }
  }

  if (!reservation) return null

  const statusConfig = RESERVATION_STATUS[reservation.status as keyof typeof RESERVATION_STATUS]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="예약 상세" size="lg">
      <div className="flex flex-col h-full">
        {/* Tab bar - sticky within scrollable area */}
        <div className="flex gap-1 px-6 pt-2 border-b border-border/50 sticky top-0 z-10 bg-bg-secondary">
          <button
            type="button"
            onClick={() => setActiveTab('detail')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'detail'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            예약 정보
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('survey')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'survey'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            만족도조사
            {survey && (
              <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-success" />
            )}
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Detail Tab */}
          {activeTab === 'detail' && (
            <div className="space-y-5">
              {/* 예약 정보 */}
              <div>
                <h4 className="text-xs font-semibold text-text-tertiary mb-3 uppercase tracking-wider">예약 정보</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <InfoRowInline
                    label="예약번호"
                    value={reservation.reserve_idx
                      ? <span className="font-mono">{reservation.reserve_idx}</span>
                      : '-'
                    }
                  />
                  <InfoRowInline
                    label="상태"
                    value={
                      <span className={`badge ${statusConfig?.class || 'badge-primary'}`}>
                        {statusConfig?.label || reservation.status}
                      </span>
                    }
                  />
                  <InfoRowInline
                    label="예약일"
                    value={
                      reservation.end_date && reservation.end_date !== reservation.reservation_date
                        ? `${reservation.reservation_date} ~ ${reservation.end_date}`
                        : reservation.reservation_date
                    }
                  />
                  <InfoRowInline
                    label="시간"
                    value={
                      reservation.start_time && reservation.end_time
                        ? `${reservation.start_time} ~ ${reservation.end_time}`
                        : reservation.time_slot === 'morning' ? '오전 (09:00~13:00)' : '오후 (14:00~18:00)'
                    }
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* 이용 정보 */}
              <div>
                <h4 className="text-xs font-semibold text-text-tertiary mb-3 uppercase tracking-wider">이용 정보</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <InfoRowInline
                    label="사용 장비"
                    value={
                      reservation.equipment_types.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {reservation.equipment_types.map((eq, i) => (
                            <span key={i} className="text-xs bg-bg-tertiary px-2 py-0.5 rounded border border-border/50">
                              {eq}
                            </span>
                          ))}
                        </div>
                      ) : '-'
                    }
                  />
                  <InfoRowInline
                    label="교육/세미나"
                    value={
                      reservation.is_training && reservation.is_seminar
                        ? '교육 · 세미나'
                        : reservation.is_training ? '교육' : reservation.is_seminar ? '세미나' : '-'
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <InfoRowInline label="2D" value={`${fmtNum(reservation.work_2d, 0)}컷`} />
                  <InfoRowInline label="3D" value={`${fmtNum(reservation.work_3d, 0)}컷`} />
                  <InfoRowInline label="영상" value={`${fmtNum(reservation.work_video, 0)}컷`} />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* 기업 정보 */}
              <div>
                <h4 className="text-xs font-semibold text-text-tertiary mb-3 uppercase tracking-wider">기업 정보</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <InfoRowInline label="기업명" value={reservation.company_name || '-'} />
                  <InfoRowInline label="사업자등록번호" value={reservation.business_number || '-'} />
                  <InfoRowInline label="기업규모" value={reservation.company_size || '-'} />
                  <InfoRowInline label="업종" value={reservation.industry || '-'} />
                  <InfoRowInline label="대표자" value={reservation.representative || '-'} />
                  <InfoRowInline label="연락처" value={reservation.contact || '-'} />
                  <div className="sm:col-span-2">
                    <InfoRowInline
                      label="첨부 서류"
                      value={
                        reservation.business_license_url || reservation.small_biz_cert_url ? (
                          <div className="flex flex-wrap gap-2 justify-end">
                            {reservation.business_license_url && (
                              <a
                                href={reservation.business_license_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
                              >
                                사업자등록증 ↗
                              </a>
                            )}
                            {reservation.small_biz_cert_url && (
                              <a
                                href={reservation.small_biz_cert_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
                              >
                                소상공인확인서 ↗
                              </a>
                            )}
                          </div>
                        ) : '-'
                      }
                    />
                  </div>
                </div>
              </div>

              {/* 요청사항 */}
              {reservation.request_notes && (
                <>
                  <div className="h-px bg-border" />
                  <div>
                    <h4 className="text-xs font-semibold text-text-tertiary mb-2 uppercase tracking-wider">요청사항</h4>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{reservation.request_notes}</p>
                  </div>
                </>
              )}

              {/* 비고 */}
              {reservation.notes && (
                <>
                  <div className="h-px bg-border" />
                  <div>
                    <h4 className="text-xs font-semibold text-text-tertiary mb-2 uppercase tracking-wider">비고</h4>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{reservation.notes}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Survey Tab */}
          {activeTab === 'survey' && (
            <div className="space-y-4">
              {surveyLoading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-text-tertiary">만족도 데이터 조회 중...</p>
                </div>
              ) : survey?.submitted_at ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-text-primary">제출된 만족도조사</h4>
                    <span className="text-xs text-text-tertiary">
                      제출일 : {new Date(survey.submitted_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>

                  {/* 전반적 만족도 */}
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-text-secondary">전반적 만족도</span>
                      <span className="text-lg font-bold text-primary tabular-nums">
                        {survey.overall_rating}점
                        <span className="text-xs text-text-tertiary ml-1">
                          ({SATISFACTION_LEVEL_LABELS[survey.overall_rating || 0] || '-'})
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* 항목별 만족도 */}
                  {survey.category_ratings && Object.keys(survey.category_ratings).length > 0 && (
                    <div className="card p-4">
                      <h5 className="text-xs font-semibold text-text-tertiary mb-3">항목별 점수</h5>
                      <div className="space-y-2">
                        {Object.entries(survey.category_ratings).map(([key, value]) => {
                          const label = SURVEY_CATEGORY_LABELS[key as keyof typeof SURVEY_CATEGORY_LABELS] || key
                          const percent = Math.max(0, Math.min(100, ((value || 0) / 5) * 100))
                          return (
                            <div key={key}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-text-secondary">{label}</span>
                                <span className="text-text-primary tabular-nums">{value}점</span>
                              </div>
                              <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 의견 */}
                  {survey.comment && (
                    <div className="card p-4">
                      <h5 className="text-xs font-semibold text-text-tertiary mb-2">기타 의견</h5>
                      <p className="text-sm text-text-primary">{survey.comment}</p>
                    </div>
                  )}
                  {survey.improvement_request && (() => {
                    let parsed: Record<string, unknown> | null = null
                    try { parsed = JSON.parse(survey.improvement_request) } catch { /* legacy plain text */ }

                    if (parsed && typeof parsed === 'object') {
                      const labels: Record<string, string> = {
                        // 현재 설문 형식
                        studio_referral: '스튜디오 경로',
                        studio_referral_other: '스튜디오 경로 (기타)',
                        benefits: '도움이 된 부분',
                        // 레거시 설문 형식
                        overall_reason: '전반적 만족도 이유',
                        equipment_improvement: '시설/장비 보완 사항',
                        booking_improvement: '예약 프로세스 개선 사항',
                        recommendation: '추천 의향',
                        recommendation_reason: '추천 이유',
                        reuse_intention: '재이용 의향',
                      }
                      const formatValue = (key: string, v: unknown): string => {
                        if (Array.isArray(v)) return v.join(', ')
                        if (typeof v !== 'string') return String(v ?? '')
                        if (key === 'recommendation' || key === 'reuse_intention')
                          return v === 'yes' ? '있다' : '없다'
                        return v
                      }
                      const entries = Object.entries(parsed).filter(([, v]) => {
                        if (Array.isArray(v)) return v.length > 0
                        if (typeof v === 'string') return v.trim().length > 0
                        return Boolean(v)
                      })
                      if (entries.length === 0) return null

                      return (
                        <div className="card p-4 space-y-2">
                          <h5 className="text-xs font-semibold text-text-tertiary mb-2">상세 응답</h5>
                          {entries.map(([key, value]) => (
                            <div key={key}>
                              <span className="text-xs text-text-tertiary">{labels[key] || key}</span>
                              <p className="text-sm text-text-primary">
                                {formatValue(key, value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )
                    }

                    // 레거시: JSON이 아닌 plain text
                    return (
                      <div className="card p-4">
                        <h5 className="text-xs font-semibold text-text-tertiary mb-2">보완 요청</h5>
                        <p className="text-sm text-text-primary">{survey.improvement_request}</p>
                      </div>
                    )
                  })()}

                  <div className="h-px bg-border" />
                  <p className="text-xs text-text-tertiary">아래에서 수정하여 다시 제출할 수 있습니다.</p>
                </div>
              ) : (
                <div className="card p-4 text-center mb-4">
                  <p className="text-sm text-text-secondary">아직 만족도조사가 제출되지 않았습니다.</p>
                  <p className="text-xs text-text-tertiary mt-1">아래 양식에서 입력할 수 있습니다.</p>
                </div>
              )}

              <SurveySubmissionForm
                options={surveyOptions}
                surveyTableNotConfigured={surveyNotConfigured}
                onSubmitted={handleSurveySubmitted}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <dt className="text-xs text-text-tertiary mb-0.5">{label}</dt>
    <dd className="text-sm text-text-primary">{value}</dd>
  </div>
)

const InfoRowInline = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-bg-tertiary/50">
    <dt className="text-xs text-text-tertiary whitespace-nowrap">{label}</dt>
    <dd className="text-sm text-text-primary text-right">{value}</dd>
  </div>
)

export type { ReservationDetail }
export default ReservationDetailModal
