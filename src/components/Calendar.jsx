import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'

const Calendar = ({ selectedDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get day of week for first day (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = monthStart.getDay()

  // Previous month navigation
  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  // Next month navigation
  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  // Day cell styling
  const getDayClass = (day) => {
    let classes = 'w-full aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer'

    if (isToday(day)) {
      classes += ' ring-1 ring-primary/50'
    }

    if (isSameDay(day, selectedDate)) {
      classes += ' bg-primary text-white shadow-md'
    } else if (!isSameMonth(day, currentMonth)) {
      classes += ' text-text-muted opacity-30'
    } else {
      classes += ' text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
    }

    return classes
  }

  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="select-none">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
          aria-label="이전 달"
        >
          ←
        </button>

        <h2 className="text-base font-semibold text-text-primary">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h2>

        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
          aria-label="다음 달"
        >
          →
        </button>
      </div>

      {/* Week Days */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`text-center text-xs font-semibold py-2 ${
              index === 0 ? 'text-danger' : index === 6 ? 'text-primary' : 'text-text-tertiary'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before month start */}
        {Array.from({ length: firstDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {/* Days of the month */}
        {daysInMonth.map((day) => (
          <button
            key={day.toString()}
            onClick={() => onDateSelect(day)}
            className={getDayClass(day)}
          >
            {format(day, 'd')}
          </button>
        ))}
      </div>
    </div>
  )
}

export default Calendar
