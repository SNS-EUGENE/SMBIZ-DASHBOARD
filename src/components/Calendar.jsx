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

  // Day cell styling - macOS/iOS inspired
  const getDayClass = (day) => {
    let classes = 'w-12 h-12 flex items-center justify-center rounded-full text-base font-medium transition-all duration-200 cursor-pointer'

    if (isToday(day) && !isSameDay(day, selectedDate)) {
      classes += ' ring-2 ring-primary/40'
    }

    if (isSameDay(day, selectedDate)) {
      classes += ' bg-primary text-white shadow-lg scale-105'
    } else if (!isSameMonth(day, currentMonth)) {
      classes += ' text-text-muted opacity-30'
    } else {
      classes += ' text-text-primary hover:bg-bg-tertiary hover:scale-105'
    }

    return classes
  }

  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="select-none w-[400px] p-4">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
          aria-label="이전 달"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-text-primary">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h2>

        <button
          onClick={handleNextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
          aria-label="다음 달"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Week Days */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`text-center text-sm font-semibold py-2 ${
              index === 0 ? 'text-danger' : index === 6 ? 'text-primary' : 'text-text-tertiary'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Empty cells for days before month start */}
        {Array.from({ length: firstDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="w-12 h-12" />
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
