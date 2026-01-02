import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { api } from '../lib/supabase'

const StatsPage = () => {
  const [selectedYear, setSelectedYear] = useState(2025)
  const [selectedMonth, setSelectedMonth] = useState(5) // 데이터가 있는 5월로 기본값
  const [equipmentStats, setEquipmentStats] = useState([])
  const [districtStats, setDistrictStats] = useState([])
  const [industryStats, setIndustryStats] = useState([])
  const [dailyTrend, setDailyTrend] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [selectedYear, selectedMonth])

  const fetchStats = async () => {
    setLoading(true)

    const [equipData, distData, indData, trendData] = await Promise.all([
      api.stats.getEquipmentStats(selectedYear, selectedMonth),
      api.stats.getDistrictStats(selectedYear, selectedMonth),
      api.stats.getIndustryStats(selectedYear, selectedMonth),
      api.stats.getDailyTrend(selectedYear, selectedMonth),
    ])

    setEquipmentStats(equipData.data || [])
    setDistrictStats(distData.data || [])
    setIndustryStats(indData.data || [])
    setDailyTrend(trendData.data || [])
    setLoading(false)
  }

  // 색상 팔레트
  const COLORS = ['#FF6363', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6']
  const EQUIPMENT_COLORS = {
    'AS360': '#8B5CF6',
    'MICRO': '#3B82F6',
    'XL': '#10B981',
    'XXL': '#F59E0B',
    '알파데스크': '#EC4899',
    '알파테이블': '#06B6D4',
    'Compact': '#6366F1',
  }

  // 통계 카드 컴포넌트
  const StatCard = ({ title, value, subtitle, icon }) => (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-text-tertiary mb-1">{title}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {subtitle && (
            <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-2xl opacity-50">{icon}</div>
        )}
      </div>
    </div>
  )

  // 요약 통계 계산
  const totalReservations = equipmentStats.reduce((sum, stat) => sum + (stat.reservation_count || 0), 0)
  const uniqueCompanies = new Set(districtStats.flatMap(d => d.unique_companies || 0)).size ||
    districtStats.reduce((sum, d) => sum + (d.unique_companies || 0), 0)
  const totalHours = equipmentStats.reduce((sum, s) => sum + (s.total_hours || 0), 0)

  // 데이터가 없는 경우
  const hasData = totalReservations > 0

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl sticky top-0 z-10">
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

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        ) : !hasData ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 opacity-30">📊</div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              데이터가 없습니다
            </h3>
            <p className="text-sm text-text-tertiary">
              {selectedYear}년 {selectedMonth}월에 등록된 예약이 없습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                title="총 예약 건수"
                value={totalReservations}
                subtitle={`${selectedMonth}월 누적`}
                icon="📋"
              />
              <StatCard
                title="이용 기업 수"
                value={uniqueCompanies}
                subtitle="중복 제외"
                icon="🏢"
              />
              <StatCard
                title="총 이용 시간"
                value={`${totalHours}h`}
                subtitle="오전/오후 각 4시간"
                icon="⏱️"
              />
              <StatCard
                title="일 평균 예약"
                value={(totalReservations / (dailyTrend.length || 1)).toFixed(1)}
                subtitle="건/일"
                icon="📈"
              />
            </div>

            {/* 차트 그리드 */}
            <div className="grid grid-cols-2 gap-6">
              {/* 장비별 예약 현황 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  장비별 예약 현황
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={equipmentStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                    <XAxis
                      dataKey="equipment_name"
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 10 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A1A',
                        border: '1px solid #2D2D2D',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '12px'
                      }}
                      formatter={(value, name) => [value, name === 'reservation_count' ? '예약 건수' : name]}
                    />
                    <Bar
                      dataKey="reservation_count"
                      radius={[4, 4, 0, 0]}
                    >
                      {equipmentStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={EQUIPMENT_COLORS[entry.equipment_name] || COLORS[index]} />
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
                {districtStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={districtStats.slice(0, 7)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ district, percent }) => `${district} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="total_reservations"
                        nameKey="district"
                      >
                        {districtStats.slice(0, 7).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1A1A1A',
                          border: '1px solid #2D2D2D',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '12px'
                        }}
                        formatter={(value) => [`${value}건`, '예약']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-text-tertiary text-sm">
                    자치구 데이터 없음
                  </div>
                )}
              </div>

              {/* 업종별 사용 시간 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  업종별 이용 시간 (상위 10개)
                </h3>
                {industryStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={industryStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                      <XAxis type="number" stroke="#6B6B6B" tick={{ fill: '#A8A8A8', fontSize: 10 }} />
                      <YAxis
                        type="category"
                        dataKey="industry"
                        stroke="#6B6B6B"
                        tick={{ fill: '#A8A8A8', fontSize: 10 }}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1A1A1A',
                          border: '1px solid #2D2D2D',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '12px'
                        }}
                        formatter={(value) => [`${value}시간`, '이용시간']}
                      />
                      <Bar dataKey="total_hours" fill="#10B981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-text-tertiary text-sm">
                    업종 데이터 없음
                  </div>
                )}
              </div>

              {/* 일별 예약 추이 */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  일별 예약 추이
                </h3>
                {dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                      <XAxis
                        dataKey="date"
                        stroke="#6B6B6B"
                        tick={{ fill: '#A8A8A8', fontSize: 10 }}
                        tickFormatter={(date) => format(new Date(date), 'd일')}
                      />
                      <YAxis
                        stroke="#6B6B6B"
                        tick={{ fill: '#A8A8A8', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1A1A1A',
                          border: '1px solid #2D2D2D',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '12px'
                        }}
                        labelFormatter={(date) => format(new Date(date), 'yyyy년 M월 d일', { locale: ko })}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="morning"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="오전"
                      />
                      <Line
                        type="monotone"
                        dataKey="afternoon"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="오후"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-text-tertiary text-sm">
                    추이 데이터 없음
                  </div>
                )}
              </div>
            </div>

            {/* 상세 테이블 */}
            <div className="grid grid-cols-2 gap-6">
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
                        <th>예약</th>
                        <th>기업수</th>
                        <th>이용시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipmentStats.map((stat, index) => (
                        <tr key={index}>
                          <td className="font-medium">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: EQUIPMENT_COLORS[stat.equipment_name] }}
                              />
                              {stat.equipment_name}
                            </div>
                          </td>
                          <td>{stat.reservation_count}건</td>
                          <td>{stat.unique_companies}개</td>
                          <td>{stat.total_hours}h</td>
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
                        <th>기업수</th>
                        <th>예약</th>
                        <th>이용시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {districtStats.slice(0, 10).map((stat, index) => (
                        <tr key={index}>
                          <td className="font-medium">{stat.district}</td>
                          <td>{stat.unique_companies}개</td>
                          <td>{stat.total_reservations}건</td>
                          <td>{stat.total_hours}h</td>
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
