import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/supabase'
import { useToast } from '../components/Toast'
import SurveySubmissionForm, { type SurveyReservationOption } from '../components/SurveySubmissionForm'
import ComplianceAgreementForm from '../components/ComplianceAgreementForm'
import type { SatisfactionSurvey, ComplianceAgreement } from '../types'

// ── 타입 ──────────────────────────────────────────────

type PageStep = 'list' | 'pin' | 'compliance' | 'survey' | 'done'

interface ReservationCard {
  reservationId: string
  reservationDate: string
  timeSlot: string
  companyName: string
  representative: string
  contact: string
  survey: SatisfactionSurvey | null
}

// ── 유틸 ──────────────────────────────────────────────

/** 오늘 날짜 YYYY-MM-DD */
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** YYYY-MM-DD → 'YYYY년 M월 D일 (요일)' */
function formatDateKR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const date = new Date(y, m - 1, d)
  return `${y}년 ${m}월 ${d}일 (${weekdays[date.getDay()]})`
}

/** 날짜 +/- 1일 */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 시간대 게이팅: 해당 타임슬롯 시작 시간 이후인지 확인 */
function isTimeSlotAccessible(reservationDate: string, timeSlot: string): boolean {
  const now = new Date()
  const [y, m, d] = reservationDate.split('-').map(Number)
  const slotDate = new Date(y, m - 1, d)

  // 예약일이 과거면 → 항상 접근 가능 (이미 끝난 예약)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (slotDate < today) return true

  // 예약일이 미래면 → 접근 불가
  if (slotDate > today) return false

  // 예약일이 오늘 → 시간 체크
  const hour = now.getHours()
  if (timeSlot === 'morning') return hour >= 9
  if (timeSlot === 'afternoon') return hour >= 13
  return true
}

/** 전화번호에서 뒷 4자리 추출 */
function extractLast4(contact: string): string {
  const digits = contact.replace(/[^0-9]/g, '')
  return digits.length >= 4 ? digits.slice(-4) : ''
}

// ── 컴포넌트 ─────────────────────────────────────────

const SurveyPage = () => {
  const toast = useToast()

  // 날짜 & 데이터
  const [currentDate, setCurrentDate] = useState(todayStr)
  const [reservations, setReservations] = useState<ReservationCard[]>([])
  const [loading, setLoading] = useState(true)

  // 페이지 상태
  const [step, setStep] = useState<PageStep>('list')
  const [selectedCard, setSelectedCard] = useState<ReservationCard | null>(null)

  // PIN 입력
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  // ── 날짜별 예약 조회 ────────────────────────

  const fetchReservations = useCallback(async (date: string) => {
    setLoading(true)
    const result = await api.surveys.getForDate(date)
    if (result.error) {
      toast.error(`조회 실패 : ${result.error.message}`)
      setReservations([])
    } else {
      setReservations(result.data || [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchReservations(currentDate)
  }, [currentDate, fetchReservations])

  // ── 날짜 이동 ─────────────────────────────

  const goToDate = (days: number) => {
    setStep('list')
    setSelectedCard(null)
    setPin('')
    setPinError(null)
    setCurrentDate((prev) => shiftDate(prev, days))
  }

  const goToToday = () => {
    setStep('list')
    setSelectedCard(null)
    setPin('')
    setPinError(null)
    setCurrentDate(todayStr())
  }

  // ── 카드 클릭 → PIN 단계 ────────────────

  const handleCardClick = (card: ReservationCard) => {
    // 시간 게이팅 체크
    if (!isTimeSlotAccessible(card.reservationDate, card.timeSlot)) {
      const timeLabel = card.timeSlot === 'morning' ? '오전 9시' : '오후 1시'
      toast.warning(`${timeLabel} 이후부터 설문이 가능합니다.`)
      return
    }

    setSelectedCard(card)
    setPin('')
    setPinError(null)
    setStep('pin')
  }

  // 동의서 상태
  const [existingCompliance, setExistingCompliance] = useState<ComplianceAgreement | null>(null)

  // ── PIN 인증 ────────────────────────────

  const handlePinSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedCard) return

    if (!/^\d{4}$/.test(pin)) {
      setPinError('4자리 숫자를 입력해주세요.')
      return
    }

    const expected = extractLast4(selectedCard.contact)
    if (!expected) {
      setPinError('등록된 연락처 정보가 없습니다. 관리자에게 문의하세요.')
      return
    }

    if (pin !== expected) {
      setPinError('번호가 일치하지 않습니다. 예약 시 등록한 전화번호 뒷 4자리를 입력해주세요.')
      return
    }

    // 인증 성공 → 동의서 확인 후 분기
    setPinError(null)

    // 기존 동의서 확인
    const { data: existing } = await api.compliance.getByReservationId(selectedCard.reservationId)
    setExistingCompliance(existing || null)

    if (existing?.agreed) {
      // 이미 동의 완료 → 바로 설문
      setStep('survey')
    } else {
      // 동의 필요 → 동의 단계
      setStep('compliance')
    }
  }

  // ── 설문 완료 ───────────────────────────

  const handleSubmitted = async () => {
    toast.success('만족도조사를 제출해주셔서 감사합니다!')
    setStep('done')
  }

  // ── 리셋 (다른 예약) ────────────────────

  const handleReset = () => {
    setStep('list')
    setSelectedCard(null)
    setPin('')
    setPinError(null)
    setExistingCompliance(null)
    fetchReservations(currentDate)
  }

  // ── 설문 옵션 (SurveySubmissionForm용) ──

  const surveyOptions: SurveyReservationOption[] = selectedCard
    ? [{
        reservationId: selectedCard.reservationId,
        label: `${selectedCard.reservationDate} · ${selectedCard.timeSlot === 'morning' ? '오전' : '오후'} · ${selectedCard.companyName}`,
        survey: selectedCard.survey,
        reservationDate: selectedCard.reservationDate,
        timeSlot: selectedCard.timeSlot,
        companyName: selectedCard.companyName,
      }]
    : []

  const isToday = currentDate === todayStr()

  // ── 렌더링 ─────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-start pt-8 pb-8 px-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-text-primary mb-1">
            SMBIZ 디지털콘텐츠제작실
          </h1>
          <p className="text-sm text-text-secondary">만족도조사</p>
        </div>

        {/* ─── Step: 예약 목록 ─────────────────── */}
        {step === 'list' && (
          <>
            {/* 날짜 네비게이션 */}
            <div className="card p-3 mb-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goToDate(-1)}
                  className="p-2 rounded-lg hover:bg-bg-tertiary transition text-text-secondary hover:text-text-primary"
                  aria-label="이전 날짜"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="text-center">
                  <div className="text-sm font-semibold text-text-primary">
                    {formatDateKR(currentDate)}
                  </div>
                  {!isToday && (
                    <button
                      type="button"
                      onClick={goToToday}
                      className="text-xs text-primary hover:text-primary/80 mt-0.5"
                    >
                      오늘로 이동
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => goToDate(1)}
                  className="p-2 rounded-lg hover:bg-bg-tertiary transition text-text-secondary hover:text-text-primary"
                  aria-label="다음 날짜"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 예약 카드 목록 */}
            {loading ? (
              <div className="card p-8 text-center">
                <div className="text-text-tertiary text-sm">불러오는 중...</div>
              </div>
            ) : reservations.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-3xl mb-3 opacity-40">&#128197;</div>
                <p className="text-sm text-text-secondary">
                  이 날짜에 확정된 예약이 없습니다.
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  날짜를 변경하여 다른 날의 예약을 확인해보세요.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reservations.map((card) => {
                  const slotLabel = card.timeSlot === 'morning' ? '오전 (09:00~13:00)' : '오후 (13:00~18:00)'
                  const hasSurvey = Boolean(card.survey?.submitted_at)
                  const accessible = isTimeSlotAccessible(card.reservationDate, card.timeSlot)

                  return (
                    <button
                      key={card.reservationId}
                      type="button"
                      onClick={() => handleCardClick(card)}
                      className={`card w-full p-4 text-left transition ${
                        accessible
                          ? 'hover:border-primary/50 hover:bg-bg-tertiary/30 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <div className="text-sm font-semibold text-text-primary">
                            {card.companyName}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {slotLabel}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {hasSurvey ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/30">
                              &#10003; 제출 완료
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30">
                              미제출
                            </span>
                          )}
                          {!accessible && (
                            <span className="text-[10px] text-text-muted">
                              {card.timeSlot === 'morning' ? '09:00' : '13:00'} 이후 가능
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ─── Step: PIN 인증 ──────────────────── */}
        {step === 'pin' && selectedCard && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 rounded-lg hover:bg-bg-tertiary transition text-text-secondary"
                aria-label="뒤로가기"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-sm font-semibold text-text-primary">본인 확인</h2>
            </div>

            <div className="rounded-lg border border-border/70 bg-bg-tertiary/20 p-3 mb-4">
              <div className="text-sm font-medium text-text-primary">{selectedCard.companyName}</div>
              <div className="text-xs text-text-secondary mt-0.5">
                {formatDateKR(selectedCard.reservationDate)} · {selectedCard.timeSlot === 'morning' ? '오전' : '오후'}
              </div>
            </div>

            <p className="text-xs text-text-tertiary mb-4">
              예약 시 등록하신 전화번호 뒷 4자리를 입력해주세요.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="input w-full tracking-[0.3em] text-center text-xl py-3"
                placeholder="0000"
                autoFocus
              />

              {pinError && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm p-3">
                  {pinError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={pin.length !== 4}
              >
                확인
              </button>
            </form>
          </div>
        )}

        {/* ─── Step: 이용자 동의 ────────────────── */}
        {step === 'compliance' && selectedCard && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-bg-tertiary transition text-text-secondary"
                  aria-label="뒤로가기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-sm font-semibold text-text-primary">이용자 준수사항 동의</h2>
              </div>
              <div className="rounded-lg border border-border/70 bg-bg-tertiary/20 p-3">
                <div className="text-sm font-medium text-text-primary">{selectedCard.companyName}</div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {formatDateKR(selectedCard.reservationDate)} · {selectedCard.timeSlot === 'morning' ? '오전' : '오후'}
                </div>
              </div>
            </div>

            <ComplianceAgreementForm
              reservationId={selectedCard.reservationId}
              companyName={selectedCard.companyName}
              applicantName={selectedCard.representative}
              date={selectedCard.reservationDate}
              hidePdfDownload
              onSubmitted={() => {
                toast.success('동의가 완료되었습니다. 만족도조사를 진행해주세요.')
                setStep('survey')
              }}
            />
          </div>
        )}

        {/* ─── Step: 설문 작성 ─────────────────── */}
        {step === 'survey' && selectedCard && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-bg-tertiary transition text-text-secondary"
                  aria-label="뒤로가기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-sm font-semibold text-text-primary">만족도 평가</h2>
              </div>
              <div className="rounded-lg border border-border/70 bg-bg-tertiary/20 p-3">
                <div className="text-sm font-medium text-text-primary">{selectedCard.companyName}</div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {formatDateKR(selectedCard.reservationDate)} · {selectedCard.timeSlot === 'morning' ? '오전' : '오후'}
                </div>
                {selectedCard.survey?.submitted_at && (
                  <p className="text-xs text-primary mt-1">
                    기존에 제출한 설문이 있습니다. 수정 후 재제출 가능합니다.
                  </p>
                )}
              </div>
            </div>

            <SurveySubmissionForm
              options={surveyOptions}
              surveyTableNotConfigured={false}
              onSubmitted={handleSubmitted}
            />
          </div>
        )}

        {/* ─── Step: 완료 ──────────────────────── */}
        {step === 'done' && (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-4">&#10003;</div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              제출 완료
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              소중한 의견 감사합니다. 더 나은 서비스를 위해 노력하겠습니다.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary"
            >
              다른 예약 설문하기
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-text-muted mt-8">
          한국SNS인재개발원 · 성수 디지털콘텐츠제작실
        </p>
      </div>
    </div>
  )
}

export default SurveyPage
