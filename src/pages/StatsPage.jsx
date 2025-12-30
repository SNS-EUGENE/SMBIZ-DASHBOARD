import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../lib/supabase'

const StatsPage = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [equipmentStats, setEquipmentStats] = useState([])
  const [districtStats, setDistrictStats] = useState([])
  const [industryStats, setIndustryStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [selectedYear, selectedMonth])

  const fetchStats = async () => {
    setLoading(true)

    const [equipData, distData, indData] = await Promise.all([
      api.stats.getEquipmentUtilization(selectedYear, selectedMonth),
      api.stats.getDistrictStats(selectedYear, selectedMonth),
      api.stats.getIndustryStats(selectedYear, selectedMonth),
    ])

    setEquipmentStats(equipData.data || [])
    setDistrictStats(distData.data || [])
    setIndustryStats(indData.data || [])
    setLoading(false)
  }

  // Mixpanel-style colors
  const COLORS = ['#FF6363', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6']

  // Stat Card Component
  const StatCard = ({ title, value, subtitle, trend, icon }) => (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-text-tertiary mb-1">{title}</p>
          <p className="text-3xl font-bold text-text-primary">{value}</p>
          {subtitle && (
            <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-3xl opacity-50">{icon}</div>
        )}
      </div>
      {trend && (
        <div className={`text-sm ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
          {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )

  // Calculate summary stats
  const totalReservations = equipmentStats.reduce((sum, stat) => sum + (stat.reservation_count || 0), 0)
  const totalCompanies = new Set(equipmentStats.map(s => s.unique_companies)).size
  const avgUtilization = equipmentStats.length > 0
    ? (equipmentStats.reduce((sum, stat) => sum + (stat.utilization_rate || 0), 0) / equipmentStats.length).toFixed(1)
    : 0

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary sticky top-0 z-10">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">통계 대시보드</h1>
              <p className="text-sm text-text-tertiary mt-1">
                가동률 및 이용 현황 분석
              </p>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-4">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="input"
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="input"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-8">
        {loading ? (
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-32" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-6">
              <StatCard
                title="총 예약 건수"
                value={totalReservations}
                subtitle={`${selectedMonth}월 누적`}
                icon="📋"
              />
              <StatCard
                title="이용 기업 수"
                value={totalCompanies}
                subtitle="중복 제외"
                icon="🏢"
              />
              <StatCard
                title="평균 가동률"
                value={`${avgUtilization}%`}
                subtitle="전체 장비 평균"
                icon="⚡"
              />
              <StatCard
                title="총 가동 시간"
                value={equipmentStats.reduce((sum, s) => sum + (s.total_hours || 0), 0).toFixed(0)}
                subtitle="시간"
                icon="⏱️"
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-2 gap-8">
              {/* Equipment Utilization Chart */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  장비별 가동률
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={equipmentStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                    <XAxis
                      dataKey="equipment_name"
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A1A',
                        border: '1px solid #2D2D2D',
                        borderRadius: '8px',
                        color: '#FFFFFF'
                      }}
                    />
                    <Bar dataKey="utilization_rate" fill="#FF6363" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* District Distribution */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  자치구별 이용 현황
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={districtStats.slice(0, 7)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
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
                        color: '#FFFFFF'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Industry Usage Hours */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  업종별 사용 시간
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={industryStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                    <XAxis type="number" stroke="#6B6B6B" tick={{ fill: '#A8A8A8', fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="industry"
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 12 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A1A',
                        border: '1px solid #2D2D2D',
                        borderRadius: '8px',
                        color: '#FFFFFF'
                      }}
                    />
                    <Bar dataKey="total_hours" fill="#10B981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Reservation Trend */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  예약 추이
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={equipmentStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                    <XAxis
                      dataKey="equipment_name"
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#6B6B6B"
                      tick={{ fill: '#A8A8A8', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A1A',
                        border: '1px solid #2D2D2D',
                        borderRadius: '8px',
                        color: '#FFFFFF'
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="reservation_count"
                      stroke="#6366F1"
                      strokeWidth={2}
                      dot={{ fill: '#6366F1', r: 4 }}
                      name="예약 건수"
                    />
                    <Line
                      type="monotone"
                      dataKey="unique_companies"
                      stroke="#EC4899"
                      strokeWidth={2}
                      dot={{ fill: '#EC4899', r: 4 }}
                      name="기업 수"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Tables */}
            <div className="grid grid-cols-2 gap-8">
              {/* Equipment Details */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  장비별 상세 통계
                </h3>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>장비명</th>
                        <th>예약</th>
                        <th>가동시간</th>
                        <th>가동률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipmentStats.map((stat, index) => (
                        <tr key={index}>
                          <td className="font-medium">{stat.equipment_name}</td>
                          <td>{stat.reservation_count}건</td>
                          <td>{stat.total_hours?.toFixed(1)}h</td>
                          <td>
                            <span className={`font-semibold ${
                              stat.utilization_rate > 50 ? 'text-success' :
                              stat.utilization_rate > 30 ? 'text-warning' :
                              'text-danger'
                            }`}>
                              {stat.utilization_rate?.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* District Details */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  자치구별 상세 통계
                </h3>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>자치구</th>
                        <th>기업 수</th>
                        <th>예약</th>
                        <th>시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {districtStats.slice(0, 10).map((stat, index) => (
                        <tr key={index}>
                          <td className="font-medium">{stat.district}</td>
                          <td>{stat.unique_companies}개</td>
                          <td>{stat.total_reservations}건</td>
                          <td>{stat.total_hours?.toFixed(0)}h</td>
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
