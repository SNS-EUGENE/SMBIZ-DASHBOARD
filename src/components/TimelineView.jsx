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
    return reservations.filter(r =>
      r.time_slot === slotId && r.equipment_types?.includes(equipment)
    )
  }

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      confirmed: { label: '확정', class: 'badge-success' },
      pending: { label: '대기', class: 'badge-warning' },
      completed: { label: '완료', class: 'badge-primary' },
      cancelled: { label: '취소', class: 'badge-danger' },
      no_show: { label: '노쇼', class: 'bg-red-900/50 text-red-300 border border-red-500/30' },
    }

    const config = statusConfig[status] || statusConfig.confirmed

    return (
      <span className={`badge ${config.class} text-[9px] px-1.5 py-0.5`}>
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
        <div className="bg-bg-elevated/40 backdrop-blur-xl border border-border rounded-lg p-2.5 hover:bg-bg-elevated/60 hover:border-border-hover hover:shadow-md transition-all duration-200 cursor-pointer">
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
        <ReservationTooltip reservation={reservation} position={position} cardKey={cardKey} />
      </div>
    )
  }

  // Empty state - macOS style - Compact
  const EmptySlot = () => (
    <div className="flex-1 bg-bg-tertiary/10 border border-dashed border-border rounded-lg flex items-center justify-center">
      <p className="text-[10px] text-text-muted">-</p>
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
    <div className="h-full flex flex-col p-6 overflow-visible">
      {/* Action Bar - Compact */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            예약 타임라인
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {format(date, 'yyyy년 M월 d일', { locale: ko })} 장비별 예약 현황
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm font-medium bg-bg-secondary/60 hover:bg-bg-secondary border border-border/60 rounded-lg transition-all flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-text-primary">새로고침</span>
        </button>
      </div>

      {/* Timeline Grid - Row per Time Slot - Flex to fill height */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {timeSlots.map((slot) => (
          <div key={slot.id} className="flex-1 bg-bg-secondary/30 backdrop-blur-2xl rounded-xl p-4 border border-border shadow-glass flex flex-col min-h-[180px]" style={{ overflow: 'visible' }}>
            {/* Time Slot Header - Compact */}
            <div className="mb-3 pb-2 border-b border-border/40 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-6 rounded-full ${slot.id === 'morning' ? 'bg-success' : 'bg-warning'}`}></div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {slot.label}
                  </h3>
                  <span className="text-xs text-text-tertiary">
                    {slot.time}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary/50 backdrop-blur-sm rounded-md border border-border/30">
                  <span className="text-xs text-text-tertiary">예약</span>
                  <span className="text-xs font-bold text-text-primary">
                    {reservations.filter(r => r.time_slot === slot.id).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Equipment Columns Grid - Flex to fill remaining space */}
            <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${equipmentTypes.length}, minmax(0, 1fr))`, overflow: 'visible', isolation: 'auto' }}>
              {equipmentTypes.map((equipment) => {
                const slotReservations = getReservationForSlot(equipment, slot.id)

                return (
                  <div key={equipment} className="min-w-0 flex flex-col" style={{ overflow: 'visible' }}>
                    {/* Equipment Header - Compact */}
                    <div className="flex items-center gap-1.5 mb-2 px-0.5 flex-shrink-0">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `var(--${getEquipmentColor(equipment)})` }}
                      />
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wide truncate">
                        {equipment}
                      </span>
                    </div>

                    {/* Reservations or Empty State */}
                    {slotReservations.length > 0 ? (
                      <div className="flex-1 space-y-2 overflow-y-auto" style={{ overflow: 'visible' }}>
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

    </div>
  )
}

export default TimelineView
