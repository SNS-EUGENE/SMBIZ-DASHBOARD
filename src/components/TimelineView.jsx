import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const TimelineView = ({ date, reservations, equipmentTypes, loading, onRefresh }) => {
  const [hoveredCard, setHoveredCard] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const hoverTimeoutRef = useRef(null)
  const cardRefs = useRef({})

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

  const timeSlots = [
    { id: 'morning', label: '오전', time: '09:00 - 13:00', hours: 4 },
    { id: 'afternoon', label: '오후', time: '14:00 - 18:00', hours: 4 },
  ]

  // Equipment color mapping
  const getEquipmentColor = (type) => {
    const colors = {
      'AS360': 'equipment-as360',
      'MICRO': 'equipment-micro',
      'XL': 'equipment-xl',
      'XXL': 'equipment-xxl',
      '알파데스크': 'equipment-desk',
      '알파테이블': 'equipment-table',
      'Compact': 'equipment-compact',
    }
    return colors[type] || 'text-text-tertiary'
  }

  // Get reservations for specific equipment and time slot
  const getReservationForSlot = (equipment, slotId) => {
    const filtered = reservations.filter(r => {
      const hasTimeSlot = r.time_slot === slotId
      const hasEquipment = r.equipment_types?.includes(equipment)

      // Debug logging - show actual array contents
      if (hasTimeSlot && reservations.length > 0 && equipment === 'AS360') {
        console.log('Debug equipment_types:', {
          company: r.company_name,
          looking_for: equipment,
          actual_array: r.equipment_types,
          array_contents: JSON.stringify(r.equipment_types),
          hasEquipment
        })
      }

      return hasTimeSlot && hasEquipment
    })
    return filtered
  }

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      confirmed: { label: '확정', class: 'badge-success' },
      pending: { label: '대기', class: 'badge-warning' },
      completed: { label: '완료', class: 'badge-primary' },
      cancelled: { label: '취소', class: 'badge-danger' },
    }

    const config = statusConfig[status] || statusConfig.confirmed

    return (
      <span className={`badge ${config.class}`}>
        {config.label}
      </span>
    )
  }

  // Tooltip Component - Portal-based for proper z-index
  const ReservationTooltip = ({ reservation, position = 'bottom', cardKey }) => {
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
              {reservation.work_2d > 0 && <div>2D: {reservation.work_2d}장</div>}
              {reservation.work_3d > 0 && <div>3D: {reservation.work_3d}장</div>}
              {reservation.work_video > 0 && <div>영상: {reservation.work_video}건</div>}
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

  // Reservation Card Component - Clean modern style
  const ReservationCard = ({ reservation, equipment, timeSlot }) => {
    const cardKey = `${reservation.id}-${equipment}-${timeSlot}`
    const isActive = hoveredCard === cardKey
    const position = timeSlot === 'afternoon' ? 'top' : 'bottom'

    const handleClick = (e) => {
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      setTooltipPosition({
        top: position === 'top' ? rect.top : rect.bottom,
        left: rect.left
      })
      setHoveredCard(hoveredCard === cardKey ? null : cardKey)
    }

    return (
      <div
        className={`relative ${isActive ? 'z-[10000]' : 'z-0'}`}
        onClick={handleClick}
      >
        <div className="bg-bg-elevated/40 backdrop-blur-xl border border-border rounded-xl p-4 hover:bg-bg-elevated/60 hover:border-border-hover hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-start justify-between mb-2.5">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-text-primary mb-1 truncate">
                {reservation.company_name}
              </h4>
              <p className="text-xs text-text-tertiary truncate">
                {reservation.representative || '대표자 미등록'}
              </p>
            </div>
            <StatusBadge status={reservation.status} />
          </div>

          {/* Info Bar */}
          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary/40 rounded-md">
              <span className="text-text-tertiary">👥</span>
              <span className="text-text-primary font-medium">{reservation.attendees}명</span>
            </div>
            {(reservation.is_training || reservation.is_seminar) && (
              <div className="flex gap-1.5">
                {reservation.is_training && (
                  <div className="px-2 py-1 bg-primary/10 text-primary rounded-md flex items-center gap-1">
                    <span>📚</span>
                  </div>
                )}
                {reservation.is_seminar && (
                  <div className="px-2 py-1 bg-warning/10 text-warning rounded-md flex items-center gap-1">
                    <span>🎤</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tooltip Portal */}
        <ReservationTooltip reservation={reservation} position={position} cardKey={cardKey} />
      </div>
    )
  }

  // Empty state - macOS style
  const EmptySlot = () => (
    <div className="bg-bg-tertiary/10 border border-dashed border-border rounded-xl p-6 text-center">
      <div className="text-2xl mb-2 opacity-20">📭</div>
      <p className="text-xs text-text-tertiary font-medium">예약 없음</p>
    </div>
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-6">
          {timeSlots.map((slot) => (
            <div key={slot.id} className="space-y-4">
              <div className="skeleton h-8 w-32"></div>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${equipmentTypes.length}, minmax(0, 1fr))` }}>
                {equipmentTypes.map((eq) => (
                  <div key={eq} className="skeleton h-32"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 overflow-visible">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            예약 타임라인
          </h2>
          <p className="text-sm text-text-tertiary mt-1">
            {format(date, 'yyyy년 M월 d일', { locale: ko })} 장비별 예약 현황
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-3.5 py-2 text-sm font-medium bg-bg-secondary/60 hover:bg-bg-secondary border border-border/60 rounded-lg transition-all flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-text-primary">새로고침</span>
        </button>
      </div>

      {/* Timeline Grid - Row per Time Slot */}
      <div className="space-y-5">
        {timeSlots.map((slot) => (
          <div key={slot.id} className="bg-bg-secondary/30 backdrop-blur-2xl rounded-2xl p-6 border border-border min-h-[340px] shadow-glass" style={{ overflow: 'visible' }}>
            {/* Time Slot Header */}
            <div className="mb-5 pb-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-1 h-10 rounded-full ${slot.id === 'morning' ? 'bg-success' : 'bg-warning'}`}></div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      {slot.label}
                    </h3>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {slot.time}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary/50 backdrop-blur-sm rounded-lg border border-border/30">
                  <span className="text-xs text-text-tertiary">예약</span>
                  <span className="text-sm font-bold text-text-primary">
                    {reservations.filter(r => r.time_slot === slot.id).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Equipment Columns Grid */}
            <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${equipmentTypes.length}, minmax(0, 1fr))`, overflow: 'visible', isolation: 'auto' }}>
              {equipmentTypes.map((equipment) => {
                const slotReservations = getReservationForSlot(equipment, slot.id)

                return (
                  <div key={equipment} className="min-w-0" style={{ overflow: 'visible' }}>
                    {/* Equipment Header */}
                    <div className="flex items-center gap-2 mb-3 px-0.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `var(--${getEquipmentColor(equipment)})` }}
                      />
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wide truncate">
                        {equipment}
                      </span>
                    </div>

                    {/* Reservations or Empty State */}
                    {slotReservations.length > 0 ? (
                      <div className="space-y-2.5" style={{ overflow: 'visible' }}>
                        {slotReservations.map((reservation) => (
                          <ReservationCard
                            key={`${reservation.id}-${equipment}-${slot.id}`}
                            reservation={reservation}
                            equipment={equipment}
                            timeSlot={slot.id}
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

      {/* Overall Empty State */}
      {reservations.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">
            예약이 없습니다
          </h3>
          <p className="text-text-tertiary">
            선택한 날짜에 등록된 예약이 없습니다.
          </p>
        </div>
      )}
    </div>
  )
}

export default TimelineView
