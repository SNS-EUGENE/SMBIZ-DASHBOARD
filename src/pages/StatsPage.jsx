import { useState, useEffect } from 'react'
import { format, getDaysInMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts'
import { api } from '../lib/supabase'

const StatsPage = () => {
  const [selectedYear, setSelectedYear] = useState(2025)
  const [selectedMonth, setSelectedMonth] = useState(5)
  const [reservations, setReservations] = useState([])
  const [equipmentStats, setEquipmentStats] = useState([])
  const [districtStats, setDistrictStats] = useState([])
  const [industryStats, setIndustryStats] = useState([])
  const [companyStats, setCompanyStats] = useState([])
  const [contentStats, setContentStats] = useState({ work2d: 0, work3d: 0, workVideo: 0 })
  const [dailyTrend, setDailyTrend] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [selectedYear, selectedMonth])

  const fetchStats = async () => {
    setLoading(true)

    // 모든 원본 데이터를 가져와서 클라이언트에서 계산
    const { data: monthlyData } = await api.stats.getMonthlyReservations(selectedYear, selectedMonth)
    setReservations(monthlyData || [])

    // 통계 계산
    if (monthlyData && monthlyData.length > 0) {
      calculateEquipmentStats(monthlyData)
      calculateDistrictStats(monthlyData)
      calculateIndustryStats(monthlyData)
      calculateCompanyStats(monthlyData)
      calculateContentStats(monthlyData)
      calculateDailyTrend(monthlyData)
    } else {
      setEquipmentStats([])
      setDistrictStats([])
      setIndustryStats([])
      setCompanyStats([])
      setContentStats({ work2d: 0, work3d: 0, workVideo: 0 })
      setDailyTrend([])
    }

    setLoading(false)
  }

  const calculateEquipmentStats = (data) => {
    const equipmentTypes = ['AS360', 'MICRO', 'XL', 'XXL', '알파데스크', '알파테이블', 'Compact']
    const stats = equipmentTypes.map(equipment => {
      const filtered = data.filter(r => r.equipment_types?.includes(equipment))
      const uniqueCompanies = new Set(filtered.map(r => r.company_id))
      return {
        equipment_name: equipment,
        reservation_count: filtered.length,
        unique_companies: uniqueCompanies.size,
        total_hours: filtered.length * 4,
      }
    }).filter(s => s.reservation_count > 0)
    setEquipmentStats(stats)
  }

  const calculateDistrictStats = (data) => {
    const districtMap = {}
    data.forEach(r => {
      const district = r.district || '미지정'
      if (!districtMap[district]) {
        districtMap[district] = {
          district,
          total_reservations: 0,
          companies: new Set(),
          total_hours: 0,
        }
      }
      districtMap[district].total_reservations++
      districtMap[district].companies.add(r.company_id)
      districtMap[district].total_hours += 4
    })

    const stats = Object.values(districtMap)
      .map(d => ({
        district: d.district,
        total_reservations: d.total_reservations,
        unique_companies: d.companies.size,
        total_hours: d.total_hours,
      }))
      .sort((a, b) => b.total_reservations - a.total_reservations)

    setDistrictStats(stats)
  }

  const calculateIndustryStats = (data) => {
    const industryMap = {}
    data.forEach(r => {
      const industry = r.industry || '미지정'
      if (!industryMap[industry]) {
        industryMap[industry] = {
          industry,
          total_reservations: 0,
          companies: new Set(),
          total_hours: 0,
        }
      }
      industryMap[industry].total_reservations++
      industryMap[industry].companies.add(r.company_id)
      industryMap[industry].total_hours += 4
    })

    const stats = Object.values(industryMap)
      .map(d => ({
        industry: d.industry,
        total_reservations: d.total_reservations,
        unique_companies: d.companies.size,
        total_hours: d.total_hours,
      }))
      .sort((a, b) => b.total_hours - a.total_hours)
      .slice(0, 10)

    setIndustryStats(stats)
  }

  const calculateCompanyStats = (data) => {
    const companyMap = {}
    data.forEach(r => {
      const companyId = r.company_id
      const companyName = r.company_name || '미지정'
      if (!companyMap[companyId]) {
        companyMap[companyId] = {
          company_id: companyId,
          company_name: companyName,
          industry: r.industry || '미지정',
          total_reservations: 0,
          total_hours: 0,
          work_2d: 0,
          work_3d: 0,
          work_video: 0,
        }
      }
      companyMap[companyId].total_reservations++
      companyMap[companyId].total_hours += 4
      companyMap[companyId].work_2d += (r.work_2d || 0)
      companyMap[companyId].work_3d += (r.work_3d || 0)
      companyMap[companyId].work_video += (r.work_video || 0)
    })

    const stats = Object.values(companyMap)
      .sort((a, b) => b.total_reservations - a.total_reservations)
      .slice(0, 15)

    setCompanyStats(stats)
  }

  const calculateContentStats = (data) => {
    const stats = {
      work2d: data.reduce((sum, r) => sum + (r.work_2d || 0), 0),
      work3d: data.reduce((sum, r) => sum + (r.work_3d || 0), 0),
      workVideo: data.reduce((sum, r) => sum + (r.work_video || 0), 0),
    }
    setContentStats(stats)
  }

  const calculateDailyTrend = (data) => {
    // 해당 월의 모든 날짜 생성
    const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth - 1))
    const allDays = []

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      allDays.push({
        date: dateStr,
        day: day,
        morning: 0,
        afternoon: 0,
        total: 0,
      })
    }

    // 예약 데이터로 채우기
    data.forEach(r => {
      const day = parseInt(r.reservation_date.split('-')[2])
      const dayData = allDays.find(d => d.day === day)
      if (dayData) {
        if (r.time_slot === 'morning') {
          dayData.morning++
        } else {
          dayData.afternoon++
        }
        dayData.total++
      }
    })

    setDailyTrend(allDays)
  }

  // 색상 팔레트
  const COLORS = ['#FF6363', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#14B8A6']
  const EQUIPMENT_COLORS = {
    'AS360': '#8B5CF6',
    'MICRO': '#3B82F6',
    'XL': '#10B981',
    'XXL': '#F59E0B',
    '알파데스크': '#EC4899',
    '알파테이블': '#06B6D4',
    'Compact': '#6366F1',
  }

  // 호버 상태 관리
  const [activeBarIndex, setActiveBarIndex] = useState(null)
  const [activePieIndex, setActivePieIndex] = useState(null)

  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-elevated/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-4 min-w-[140px]">
          <p className="text-sm font-semibold text-text-primary mb-2 pb-2 border-b border-border">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs text-text-secondary">{entry.name}</span>
              </div>
              <span className="text-sm font-bold text-text-primary">{entry.value}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  // 파이차트 커스텀 툴팁
  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-bg-elevated/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-4 min-w-[160px]">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
            <p className="text-sm font-semibold text-text-primary">{data.district}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-text-secondary">예약 건수</span>
              <span className="text-sm font-bold text-text-primary">{data.total_reservations}건</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-text-secondary">기업 수</span>
              <span className="text-sm font-bold text-text-primary">{data.unique_companies}개</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-text-secondary">이용 시간</span>
              <span className="text-sm font-bold text-text-primary">{data.total_hours}h</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // 요약 통계 계산
  const totalReservations = reservations.length
  const uniqueCompanyIds = new Set(reservations.map(r => r.company_id))
  const uniqueCompanies = uniqueCompanyIds.size
  const totalHours = totalReservations * 4
  const morningCount = reservations.filter(r => r.time_slot === 'morning').length
  const afternoonCount = reservations.filter(r => r.time_slot === 'afternoon').length

  // 데이터가 없는 경우
  const hasData = totalReservations > 0

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary">통계 대시보드</h1>
              <p className="text-xs text-text-tertiary mt-0.5">
                예약 현황 및 이용 통계 분석
              </p>
            </div>

            {/* 날짜 필터 */}
            <div className="flex items-center gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="input text-sm py-1.5"
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="input text-sm py-1.5"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading ? (
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        ) : !hasData ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 opacity-30">
              <svg className="mx-auto" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              데이터가 없습니다
            </h3>
            <p className="text-sm text-text-tertiary">
              {selectedYear}년 {selectedMonth}월에 등록된 예약이 없습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 요약 카드 - 첫 번째 줄 */}
            <div className="grid grid-cols-5 gap-4">
              <div className="card p-4">
                <p className="text-xs text-text-tertiary mb-1">총 예약 건수</p>
                <p className="text-2xl font-bold text-text-primary">{totalReservations}</p>
                <p className="text-xs text-text-secondary mt-1">오전 {morningCount} / 오후 {afternoonCount}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-tertiary mb-1">이용 기업 수</p>
                <p className="text-2xl font-bold text-text-primary">{uniqueCompanies}</p>
                <p className="text-xs text-text-secondary mt-1">중복 제외</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-tertiary mb-1">총 이용 시간</p>
                <p className="text-2xl font-bold text-text-primary">{totalHours}h</p>
                <p className="text-xs text-text-secondary mt-1">오전/오후 각 4시간</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-tertiary mb-1">일 평균 예약</p>
                <p className="text-2xl font-bold text-text-primary">
                  {(totalReservations / getDaysInMonth(new Date(selectedYear, selectedMonth - 1))).toFixed(1)}
                </p>
                <p className="text-xs text-text-secondary mt-1">건/일</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-text-tertiary mb-1">기업당 평균</p>
                <p className="text-2xl font-bold text-text-primary">
                  {uniqueCompanies > 0 ? (totalReservations / uniqueCompanies).toFixed(1) : 0}
                </p>
                <p className="text-xs text-text-secondary mt-1">건/기업</p>
              </div>
            </div>

            {/* 콘텐츠 통계 카드 - 두 번째 줄 */}
            <div className="grid grid-cols-4 gap-4">
              <div className="card p-4 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">2D 콘텐츠</p>
                    <p className="text-2xl font-bold text-blue-400">{contentStats.work2d.toLocaleString()}</p>
                    <p className="text-xs text-text-secondary mt-1">장</p>
                  </div>
                  <div className="text-blue-400/40">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M9 9h6v6H9z"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="card p-4 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">3D 콘텐츠</p>
                    <p className="text-2xl font-bold text-purple-400">{contentStats.work3d.toLocaleString()}</p>
                    <p className="text-xs text-text-secondary mt-1">장</p>
                  </div>
                  <div className="text-purple-400/40">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/>
                      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="card p-4 bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">동영상</p>
                    <p className="text-2xl font-bold text-orange-400">{contentStats.workVideo.toLocaleString()}</p>
                    <p className="text-xs text-text-secondary mt-1">건</p>
                  </div>
                  <div className="text-orange-400/40">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="M10 9l5 3-5 3V9z"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="card p-4 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">총 콘텐츠</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {(contentStats.work2d + contentStats.work3d + contentStats.workVideo).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">건</p>
                  </div>
                  <div className="text-emerald-400/40">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 차트 그리드 */}
            <div className="grid grid-cols-2 gap-6">
              {/* 장비별 예약 현황 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  장비별 예약 현황
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={equipmentStats}
                    margin={{ bottom: 20 }}
                    onMouseLeave={() => setActiveBarIndex(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="equipment_name"
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar
                      dataKey="reservation_count"
                      name="예약 건수"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={50}
                      onMouseEnter={(_, index) => setActiveBarIndex(index)}
                    >
                      {equipmentStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={EQUIPMENT_COLORS[entry.equipment_name] || COLORS[index]}
                          fillOpacity={activeBarIndex === null || activeBarIndex === index ? 1 : 0.4}
                          style={{
                            filter: activeBarIndex === index ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' : 'none',
                            transform: activeBarIndex === index ? 'scaleY(1.02)' : 'scaleY(1)',
                            transformOrigin: 'bottom',
                            transition: 'all 0.2s ease-out',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 자치구별 분포 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  자치구별 이용 현황
                </h3>
                {districtStats.filter(d => d.district !== '미지정' && d.district !== '주소없음').length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={280}>
                      <PieChart>
                        <Pie
                          data={districtStats.filter(d => d.district !== '미지정' && d.district !== '주소없음').slice(0, 8)}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="total_reservations"
                          nameKey="district"
                          onMouseEnter={(_, index) => setActivePieIndex(index)}
                          onMouseLeave={() => setActivePieIndex(null)}
                        >
                          {districtStats.filter(d => d.district !== '미지정' && d.district !== '주소없음').slice(0, 8).map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                              fillOpacity={activePieIndex === null || activePieIndex === index ? 1 : 0.4}
                              stroke={activePieIndex === index ? COLORS[index % COLORS.length] : 'transparent'}
                              strokeWidth={activePieIndex === index ? 3 : 0}
                              style={{
                                filter: activePieIndex === index ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' : 'none',
                                transition: 'all 0.2s ease-out',
                                cursor: 'pointer'
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        {/* 중앙 텍스트 */}
                        <text x="50%" y="46%" textAnchor="middle" className="fill-text-tertiary text-xs">
                          총 예약
                        </text>
                        <text x="50%" y="56%" textAnchor="middle" className="fill-text-primary text-lg font-bold">
                          {districtStats.filter(d => d.district !== '미지정' && d.district !== '주소없음').reduce((sum, d) => sum + d.total_reservations, 0)}건
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* 커스텀 레전드 */}
                    <div className="flex-1 space-y-2 pr-2">
                      {districtStats.filter(d => d.district !== '미지정' && d.district !== '주소없음').slice(0, 8).map((entry, index) => {
                        const total = districtStats.filter(d => d.district !== '미지정' && d.district !== '주소없음').slice(0, 8).reduce((sum, d) => sum + d.total_reservations, 0)
                        const percent = ((entry.total_reservations / total) * 100).toFixed(1)
                        return (
                          <div
                            key={index}
                            className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-all cursor-pointer ${activePieIndex === index ? 'bg-white/5' : 'hover:bg-white/3'}`}
                            onMouseEnter={() => setActivePieIndex(index)}
                            onMouseLeave={() => setActivePieIndex(null)}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-xs text-text-secondary">{entry.district}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-text-primary">{entry.total_reservations}건</span>
                              <span className="text-xs text-text-tertiary w-10 text-right">{percent}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-[280px] flex flex-col items-center justify-center text-text-tertiary">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-50">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8v4l2 2"/>
                    </svg>
                    <p className="text-sm">자치구 데이터가 등록되지 않았습니다</p>
                    <p className="text-xs mt-1">기업 정보에 자치구를 등록해주세요</p>
                  </div>
                )}
              </div>

              {/* 업종별 사용 시간 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  업종별 이용 시간 (상위 10개)
                </h3>
                {industryStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={industryStats} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="#6B6B6B"
                        tick={{ fill: '#A8A8A8', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="industry"
                        stroke="#6B6B6B"
                        tick={{ fill: '#A8A8A8', fontSize: 11 }}
                        width={80}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar
                        dataKey="total_hours"
                        name="이용시간(h)"
                        radius={[0, 8, 8, 0]}
                        maxBarSize={30}
                      >
                        {industryStats.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill="#10B981"
                            style={{
                              filter: 'drop-shadow(0 2px 6px rgba(16, 185, 129, 0.3))',
                              cursor: 'pointer'
                            }}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-text-tertiary text-sm">
                    업종 데이터 없음
                  </div>
                )}
              </div>

              {/* 일별 예약 추이 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  일별 예약 추이
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyTrend} margin={{ right: 10 }}>
                    <defs>
                      <linearGradient id="colorMorning" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAfternoon" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="day"
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 10 }}
                      tickFormatter={(day) => `${day}일`}
                      interval="preserveStartEnd"
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      labelFormatter={(day) => `${selectedMonth}월 ${day}일`}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => <span className="text-xs text-text-secondary">{value}</span>}
                    />
                    <Area
                      type="monotone"
                      dataKey="morning"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorMorning)"
                      name="오전"
                    />
                    <Area
                      type="monotone"
                      dataKey="afternoon"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAfternoon)"
                      name="오후"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 상세 테이블 */}
            <div className="grid grid-cols-3 gap-6">
              {/* 장비별 상세 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  장비별 상세 통계
                </h3>
                <div className="overflow-x-auto">
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <th>장비명</th>
                        <th className="text-right">예약</th>
                        <th className="text-right">기업수</th>
                        <th className="text-right">이용시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipmentStats.map((stat, index) => (
                        <tr key={index}>
                          <td className="font-medium">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: EQUIPMENT_COLORS[stat.equipment_name] }}
                              />
                              {stat.equipment_name}
                            </div>
                          </td>
                          <td className="text-right">{stat.reservation_count}건</td>
                          <td className="text-right">{stat.unique_companies}개</td>
                          <td className="text-right">{stat.total_hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 자치구별 상세 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  자치구별 상세 통계
                </h3>
                <div className="overflow-x-auto">
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <th>자치구</th>
                        <th className="text-right">기업수</th>
                        <th className="text-right">예약</th>
                        <th className="text-right">이용시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {districtStats
                        .filter(d => d.district !== '미지정' && d.district !== '주소없음')
                        .slice(0, 10)
                        .map((stat, index) => (
                        <tr key={index}>
                          <td className="font-medium">{stat.district}</td>
                          <td className="text-right">{stat.unique_companies}개</td>
                          <td className="text-right">{stat.total_reservations}건</td>
                          <td className="text-right">{stat.total_hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 기업별 이용 현황 (새로 추가) */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  기업별 이용 현황 (상위 15개)
                </h3>
                <div className="overflow-x-auto">
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <th>기업명</th>
                        <th className="text-right">예약</th>
                        <th className="text-right">2D</th>
                        <th className="text-right">3D</th>
                        <th className="text-right">영상</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyStats.map((stat, index) => (
                        <tr key={index}>
                          <td className="font-medium truncate max-w-[100px]" title={stat.company_name}>
                            {stat.company_name}
                          </td>
                          <td className="text-right">{stat.total_reservations}</td>
                          <td className="text-right text-blue-400">{stat.work_2d || '-'}</td>
                          <td className="text-right text-purple-400">{stat.work_3d || '-'}</td>
                          <td className="text-right text-orange-400">{stat.work_video || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default StatsPage
