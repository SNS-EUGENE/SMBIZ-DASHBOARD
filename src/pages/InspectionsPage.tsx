import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import FacilityInspectionTab from '../components/FacilityInspectionTab'
import EquipmentInspectionTab from '../components/EquipmentInspectionTab'

type Tab = 'facility' | 'equipment'

const TABS: { key: Tab; label: string }[] = [
  { key: 'facility', label: '시설 점검' },
  { key: 'equipment', label: '장비 점검' },
]

const InspectionsPage = () => {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [activeTab, setActiveTab] = useState<Tab>('facility')

  const navigateMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setYear(y)
    setMonth(m)
  }

  const goToCurrentMonth = () => {
    const n = new Date()
    setYear(n.getFullYear())
    setMonth(n.getMonth() + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-text-primary">점검 관리</h1>
            <p className="text-xs text-text-tertiary mt-0.5 hidden md:block">시설 및 장비 점검 관리</p>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <button
              onClick={() => navigateMonth(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs md:text-sm font-semibold text-text-primary min-w-[80px] md:min-w-[100px] text-center">
              {year}년 {month}월
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            {!isCurrentMonth && (
              <button
                onClick={goToCurrentMonth}
                className="ml-0.5 px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors whitespace-nowrap"
              >
                이번 달
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-2 bg-bg-secondary/60 rounded-lg p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${
                activeTab === tab.key
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'facility' ? (
          <FacilityInspectionTab year={year} month={month} />
        ) : (
          <EquipmentInspectionTab year={year} month={month} />
        )}
      </div>
    </div>
  )
}

export default InspectionsPage
