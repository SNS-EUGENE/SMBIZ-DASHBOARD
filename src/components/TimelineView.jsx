const TimelineView = ({ date, reservations, equipmentTypes, loading, onRefresh }) => {
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
      r.time_slot === slotId &&
      r.equipment_types?.includes(equipment)
    )
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

  // Reservation Card Component
  const ReservationCard = ({ reservation }) => {
    return (
      <div className="card p-4 hover:scale-[1.02] transition-transform cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-text-primary mb-1">
              {reservation.company_name}
            </h4>
            <p className="text-xs text-text-tertiary">
              {reservation.representative} · {reservation.industry}
            </p>
          </div>
          <StatusBadge status={reservation.status} />
        </div>

        {/* Equipment Tags */}
        {reservation.equipment_types && (
          <div className="flex flex-wrap gap-2 mb-3">
            {reservation.equipment_types.map((eq, idx) => (
              <span
                key={idx}
                className="badge-equipment"
                style={{
                  backgroundColor: `var(--${getEquipmentColor(eq)})20`,
                  borderColor: `var(--${getEquipmentColor(eq)})`,
                  color: `var(--${getEquipmentColor(eq)})`,
                }}
              >
                {eq}
              </span>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            👥 {reservation.attendees}명
          </span>
          <span className="flex items-center gap-1">
            ⏱️ {reservation.total_hours}시간
          </span>
          {reservation.is_training && (
            <span className="badge badge-primary text-xs">교육</span>
          )}
          {reservation.is_seminar && (
            <span className="badge badge-primary text-xs">세미나</span>
          )}
        </div>
      </div>
    )
  }

  // Empty state
  const EmptySlot = () => (
    <div className="card p-6 text-center">
      <div className="text-4xl mb-2">📭</div>
      <p className="text-sm text-text-tertiary">예약 없음</p>
    </div>
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-2 gap-6">
          {timeSlots.map((slot) => (
            <div key={slot.id} className="space-y-4">
              <div className="skeleton h-8 w-32"></div>
              {equipmentTypes.map((eq) => (
                <div key={eq} className="skeleton h-32"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            타임라인 뷰
          </h2>
          <p className="text-sm text-text-tertiary mt-1">
            장비별 시간대 예약 현황
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="btn btn-secondary"
        >
          🔄 새로고침
        </button>
      </div>

      {/* Timeline Grid */}
      <div className="grid grid-cols-2 gap-8">
        {timeSlots.map((slot) => (
          <div key={slot.id}>
            {/* Time Slot Header */}
            <div className="mb-4 pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    {slot.label}
                  </h3>
                  <p className="text-xs text-text-tertiary mt-1">
                    {slot.time}
                  </p>
                </div>
                <span className="text-xs text-text-muted bg-bg-tertiary px-3 py-1 rounded-full">
                  {getReservationForSlot(null, slot.id).length}건 예약
                </span>
              </div>
            </div>

            {/* Equipment Rows */}
            <div className="space-y-4">
              {equipmentTypes.map((equipment) => {
                const slotReservations = getReservationForSlot(equipment, slot.id)

                return (
                  <div key={equipment}>
                    {/* Equipment Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: `var(--${getEquipmentColor(equipment)})` }}
                      />
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        {equipment}
                      </span>
                    </div>

                    {/* Reservations or Empty State */}
                    {slotReservations.length > 0 ? (
                      <div className="space-y-2">
                        {slotReservations.map((reservation) => (
                          <ReservationCard
                            key={reservation.id}
                            reservation={reservation}
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
