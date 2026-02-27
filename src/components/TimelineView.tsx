import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { EQUIPMENT_CSS_COLORS, RESERVATION_STATUS } from '../constants'
import { fmtNum } from '../lib/utils'
import type { ReservationWithDetails, ReservationStatus, EquipmentType } from '../types'

// ========================================
// Interfaces
// ========================================

interface TooltipPosition {
  top: number
  left: number
}

interface TimeSlot {
  id: string
  label: string
  time: string
  hours: number
}

interface StatusBadgeProps {
  status: ReservationStatus
}

interface ReservationTooltipProps {
  reservation: ReservationWithDetails
  position: 'top' | 'bottom'
  cardKey: string
  hoveredCard: string | null
  tooltipPosition: TooltipPosition
}

interface ReservationCardProps {
  reservation: ReservationWithDetails
  equipment: string
  timeSlot: string
  hoveredCard: string | null
  setHoveredCard: (card: string | null) => void
  tooltipPosition: TooltipPosition
  setTooltipPosition: (position: TooltipPosition) => void
}

interface TimelineViewProps {
  reservations: ReservationWithDetails[]
  equipmentTypes: EquipmentType[]
  loading: boolean
}

// ========================================
// Helper Functions
// ========================================

// Equipment color mapping - 모듈 스코프
const getEquipmentColor = (type: string): string => {
  return EQUIPMENT_CSS_COLORS[type] || 'text-text-tertiary'
}

// Status badge component - 모듈 스코프
const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = RESERVATION_STATUS[status] || RESERVATION_STATUS.confirmed

  return (
    <span className={`badge ${config.class} text-[9px] px-1.5 py-0.5`}>
      {config.label}
    </span>
  )
}

// Empty state - 모듈 스코프
const EmptySlot = () => (
  <div className="flex-1 bg-bg-tertiary/10 border border-dashed border-border rounded-lg flex items-center justify-center">
    <p className="text-[10px] text-text-muted">-</p>
  </div>
)

// Tooltip Component - 모듈 스코프
const ReservationTooltip = ({ reservation, position, cardKey, hoveredCard, tooltipPosition }: ReservationTooltipProps) => {
  if (!hoveredCard || hoveredCard !== cardKey) return null

  return createPortal(
    <div
      className="fixed w-80 bg-bg-elevated/95 backdrop-blur-2xl border border-border rounded-xl shadow-xl p-5 animate-fade-in pointer-events-none"
      style={{
        top: position === 'top' ? `${tooltipPosition.top - 8}px` : `${tooltipPosition.top + 8}px`,
        left: `${tooltipPosition.left}px`,
        transform: position === 'top' ? 'translateY(-100%)' : 'none',
        zIndex: 999999,
        pointerEvents: 'none'
      }}
    >
      {/* Header */}
      <div className="mb-3 pb-3 border-b border-border">
        <h3 className="text-base font-bold text-text-primary mb-1">
          {reservation.company_name}
        </h3>
        <div className="flex items-center gap-2">
          <StatusBadge status={reservation.status} />
        </div>
      </div>

      {/* Details Grid */}
      <div className="space-y-2.5 text-sm">
        {reservation.representative && (
          <div className="flex items-start gap-3">
            <span className="text-text-tertiary w-20 flex-shrink-0">대표자</span>
            <span className="text-text-primary font-medium">{reservation.representative}</span>
          </div>
        )}

        {reservation.contact && (
          <div className="flex items-start gap-3">
            <span className="text-text-tertiary w-20 flex-shrink-0">연락처</span>
            <span className="text-text-primary font-mono">{reservation.contact}</span>
          </div>
        )}

        {reservation.industry && (
          <div className="flex items-start gap-3">
            <span className="text-text-tertiary w-20 flex-shrink-0">업종</span>
            <span className="text-text-primary">{reservation.industry}</span>
          </div>
        )}

        {reservation.district && (
          <div className="flex items-start gap-3">
            <span className="text-text-tertiary w-20 flex-shrink-0">지자체</span>
            <span className="text-text-primary">{reservation.district}</span>
          </div>
        )}

        {reservation.equipment_types && reservation.equipment_types.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-text-tertiary w-20 flex-shrink-0">장비</span>
            <div className="flex flex-wrap gap-1.5">
              {reservation.equipment_types.map((eq, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-xs font-medium border"
                  style={{
                    backgroundColor: `var(--${getEquipmentColor(eq)})15`,
                    borderColor: `var(--${getEquipmentColor(eq)})30`,
                    color: `var(--${getEquipmentColor(eq)})`,
                  }}
                >
                  {eq}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <span className="text-text-tertiary w-20 flex-shrink-0">인원</span>
          <span className="text-text-primary">{reservation.attendees}명</span>
        </div>

        {(reservation.work_2d > 0 || reservation.work_3d > 0 || reservation.work_video > 0) && (
          <div className="flex items-start gap-3">
            <span className="text-text-tertiary w-20 flex-shrink-0">작업량</span>
            <div className="text-text-primary space-y-1">
              {reservation.work_2d > 0 && <div>2D : {fmtNum(reservation.work_2d, 0)}장</div>}
              {reservation.work_3d > 0 && <div>3D : {fmtNum(reservation.work_3d, 0)}장</div>}
              {reservation.work_video > 0 && <div>영상 : {fmtNum(reservation.work_video, 0)}건</div>}
            </div>
          </div>
        )}

        {(reservation.is_training || reservation.is_seminar) && (
          <div className="flex items-start gap-3">
            <span className="text-text-tertiary w-20 flex-shrink-0">분류</span>
            <div className="flex gap-2">
              {reservation.is_training && <span className="badge badge-primary text-xs">교육</span>}
              {reservation.is_seminar && <span className="badge badge-primary text-xs">세미나</span>}
            </div>
          </div>
        )}

        {reservation.notes && (
          <div className="flex items-start gap-3 pt-2 border-t border-border">
            <span className="text-text-tertiary w-20 flex-shrink-0">비고</span>
            <span className="text-text-secondary text-xs">{reservation.notes}</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// Reservation Card Component - 모듈 스코프
const ReservationCard = ({ reservation, equipment, timeSlot, hoveredCard, setHoveredCard, tooltipPosition, setTooltipPosition }: ReservationCardProps) => {
  const cardKey = `${reservation.id}-${equipment}-${timeSlot}`
  const isActive = hoveredCard === cardKey
  const position: 'top' | 'bottom' = timeSlot === 'afternoon' ? 'top' : 'bottom'

  const toggleTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    setTooltipPosition({
      top: position === 'top' ? rect.top : rect.bottom,
      left: rect.left
    })
    setHoveredCard(hoveredCard === cardKey ? null : cardKey)
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    toggleTooltip(e.currentTarget)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      toggleTooltip(e.currentTarget)
    } else if (e.key === 'Escape' && isActive) {
      setHoveredCard(null)
    }
  }

  return (
    <div
      className={`relative ${isActive ? 'z-[10000]' : 'z-0'}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-expanded={isActive}
      aria-label={`${reservation.company_name} - ${reservation.status === 'confirmed' ? '확정' : reservation.status}`}
    >
      <div className="bg-bg-elevated/40 backdrop-blur-xl border border-border rounded-lg p-2.5 hover:bg-bg-elevated/60 hover:border-border-hover hover:shadow-md focus-within:ring-2 focus-within:ring-primary/50 transition-all duration-200 cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-text-primary truncate">
              {reservation.company_name}
            </h4>
            <p className="text-[10px] text-text-tertiary truncate">
              {reservation.representative || '대표자 미등록'}
            </p>
          </div>
          <StatusBadge status={reservation.status} />
        </div>

        {/* Info Bar - Compact */}
        <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
          <span className="text-text-tertiary">{reservation.attendees}명</span>
          {reservation.is_training && <span className="text-primary">교육</span>}
          {reservation.is_seminar && <span className="text-warning">세미나</span>}
        </div>
      </div>

      {/* Tooltip Portal */}
      <ReservationTooltip
        reservation={reservation}
        position={position}
        cardKey={cardKey}
        hoveredCard={hoveredCard}
        tooltipPosition={tooltipPosition}
      />
    </div>
  )
}

const TimelineView = ({ reservations, equipmentTypes, loading }: TimelineViewProps) => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ top: 0, left: 0 })

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setHoveredCard(null)
    }

    if (hoveredCard) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [hoveredCard])

  const timeSlots: TimeSlot[] = [
    { id: 'morning', label: '오전', time: '09:00 - 13:00', hours: 4 },
    { id: 'afternoon', label: '오후', time: '14:00 - 18:00', hours: 4 },
  ]

  // Pre-compute reservation lookup map for O(1) access
  const slotMap = useMemo(() => {
    const map = new Map<string, ReservationWithDetails[]>()
    for (const r of reservations) {
      if (!r.equipment_types) continue
      for (const eq of r.equipment_types) {
        const key = `${eq}::${r.time_slot}`
        const existing = map.get(key) || []
        existing.push(r)
        map.set(key, existing)
      }
    }
    return map
  }, [reservations])

  const getReservationForSlot = (equipment: string, slotId: string): ReservationWithDetails[] => {
    return slotMap.get(`${equipment}::${slotId}`) || []
  }

  if (loading) {
    return (
      <div className="p-3 md:p-8">
        <div className="space-y-4 md:space-y-6">
          {timeSlots.map((slot) => (
            <div key={slot.id} className="space-y-3 md:space-y-4">
              <div className="skeleton h-8 w-32"></div>
              <div className="grid grid-cols-2 md:grid-cols-none gap-3 md:gap-4" style={{ gridTemplateColumns: undefined }}>
                {equipmentTypes.slice(0, 4).map((eq) => (
                  <div key={eq} className="skeleton h-20 md:h-32"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-3 md:p-6 overflow-auto md:overflow-visible">
      {/* Timeline Grid - Row per Time Slot - Flex to fill height */}
      <div className="flex-1 flex flex-col gap-3 md:gap-4 min-h-0">
        {timeSlots.map((slot) => (
          <div key={slot.id} className="md:flex-1 bg-bg-secondary/30 backdrop-blur-2xl rounded-xl p-3 md:p-4 border border-border shadow-glass flex flex-col md:min-h-[220px]" style={{ overflow: 'visible' }}>
            {/* Time Slot Header - Compact */}
            <div className="mb-2 md:mb-3 pb-2 border-b border-border/40 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-5 md:h-6 rounded-full ${slot.id === 'morning' ? 'bg-success' : 'bg-warning'}`}></div>
                  <h3 className="text-xs md:text-sm font-semibold text-text-primary">
                    {slot.label}
                  </h3>
                  <span className="text-[10px] md:text-xs text-text-tertiary">
                    {slot.time}
                  </span>
                </div>
                <div className="flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 py-0.5 md:py-1 bg-bg-tertiary/50 backdrop-blur-sm rounded-md border border-border/30">
                  <span className="text-[10px] md:text-xs text-text-tertiary">예약</span>
                  <span className="text-[10px] md:text-xs font-bold text-text-primary">
                    {reservations.filter(r => r.time_slot === slot.id).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Equipment Columns - Vertical on mobile, horizontal grid on desktop */}
            {/* Mobile: show only equipment with reservations as stacked cards */}
            <div className="flex-1 flex flex-col gap-2 md:hidden" style={{ overflow: 'visible' }}>
              {equipmentTypes.map((equipment) => {
                const slotReservations = getReservationForSlot(equipment, slot.id)
                if (slotReservations.length === 0) return null

                return (
                  <div key={equipment} className="min-w-0" style={{ overflow: 'visible' }}>
                    <div className="flex items-center gap-1.5 mb-1 px-0.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `var(--${getEquipmentColor(equipment)})` }}
                      />
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wide">
                        {equipment}
                      </span>
                    </div>
                    <div className="space-y-1.5" style={{ overflow: 'visible' }}>
                      {slotReservations.map((reservation) => (
                        <ReservationCard
                          key={`${reservation.id}-${equipment}-${slot.id}`}
                          reservation={reservation}
                          equipment={equipment}
                          timeSlot={slot.id}
                          hoveredCard={hoveredCard}
                          setHoveredCard={setHoveredCard}
                          tooltipPosition={tooltipPosition}
                          setTooltipPosition={setTooltipPosition}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
              {/* Empty state if no reservations at all */}
              {reservations.filter(r => r.time_slot === slot.id).length === 0 && (
                <div className="flex-1 flex items-center justify-center py-4">
                  <p className="text-xs text-text-muted">예약 없음</p>
                </div>
              )}
            </div>

            {/* Desktop: horizontal grid */}
            <div className="flex-1 hidden md:grid gap-3" style={{ gridTemplateColumns: `repeat(${equipmentTypes.length}, minmax(0, 1fr))`, overflow: 'visible', isolation: 'auto' }}>
              {equipmentTypes.map((equipment) => {
                const slotReservations = getReservationForSlot(equipment, slot.id)

                return (
                  <div key={equipment} className="min-w-0 flex flex-col min-h-[80px]" style={{ overflow: 'visible' }}>
                    <div className="flex items-center gap-1.5 mb-2 px-0.5 flex-shrink-0">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `var(--${getEquipmentColor(equipment)})` }}
                      />
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wide truncate">
                        {equipment}
                      </span>
                    </div>
                    {slotReservations.length > 0 ? (
                      <div className="flex-1 space-y-2" style={{ overflow: 'visible' }}>
                        {slotReservations.map((reservation) => (
                          <ReservationCard
                            key={`${reservation.id}-${equipment}-${slot.id}`}
                            reservation={reservation}
                            equipment={equipment}
                            timeSlot={slot.id}
                            hoveredCard={hoveredCard}
                            setHoveredCard={setHoveredCard}
                            tooltipPosition={tooltipPosition}
                            setTooltipPosition={setTooltipPosition}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptySlot />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TimelineView
