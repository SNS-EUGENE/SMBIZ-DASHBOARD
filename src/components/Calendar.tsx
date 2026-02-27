import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface CalendarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

const Calendar = ({ selectedDate, onDateSelect }: CalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const firstDayOfWeek = monthStart.getDay()

  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="select-none w-[400px] p-4">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
          aria-label="이전 달"
        >
          <ChevronLeft size={16} />
        </button>

        <h2 className="text-lg font-semibold text-text-primary">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h2>

        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
          aria-label="다음 달"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Week Days */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              'text-center text-sm font-semibold py-2',
              index === 0 && 'text-danger',
              index === 6 && 'text-primary',
              index !== 0 && index !== 6 && 'text-text-tertiary'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: firstDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="w-12 h-12" />
        ))}

        {daysInMonth.map((day) => (
          <button
            key={day.toString()}
            onClick={() => onDateSelect(day)}
            className={cn(
              'w-12 h-12 flex items-center justify-center rounded-full text-base font-medium transition-all duration-200 cursor-pointer',
              isToday(day) && !isSameDay(day, selectedDate) && 'ring-2 ring-primary/40',
              isSameDay(day, selectedDate) && 'bg-primary text-white shadow-lg scale-105',
              !isSameDay(day, selectedDate) && !isSameMonth(day, currentMonth) && 'text-text-muted opacity-30',
              !isSameDay(day, selectedDate) && isSameMonth(day, currentMonth) && 'text-text-primary hover:bg-bg-tertiary hover:scale-105',
            )}
          >
            {format(day, 'd')}
          </button>
        ))}
      </div>
    </div>
  )
}

export default Calendar
