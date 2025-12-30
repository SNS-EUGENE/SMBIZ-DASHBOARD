import { useState, useEffect } from 'react'
import { api } from '../lib/supabase'

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('companies')
  const [companies, setCompanies] = useState([])
  const [reservations, setReservations] = useState([])
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)

    if (activeTab === 'companies') {
      const { data } = await api.companies.getAll()
      setCompanies(data || [])
    } else if (activeTab === 'reservations') {
      const { data } = await api.reservations.getAll()
      setReservations(data || [])
    } else if (activeTab === 'equipment') {
      const { data } = await api.equipment.getAll()
      setEquipment(data || [])
    }

    setLoading(false)
  }

  const tabs = [
    { id: 'companies', label: '기업 관리', icon: '🏢', count: companies.length },
    { id: 'reservations', label: '예약 관리', icon: '📅', count: reservations.length },
    { id: 'equipment', label: '장비 관리', icon: '🔧', count: equipment.length },
  ]

  // Filter data based on search
  const filterData = (data, query) => {
    if (!query) return data

    const lowerQuery = query.toLowerCase()

    if (activeTab === 'companies') {
      return data.filter(item =>
        item.name?.toLowerCase().includes(lowerQuery) ||
        item.representative?.toLowerCase().includes(lowerQuery) ||
        item.industry?.toLowerCase().includes(lowerQuery) ||
        item.district?.toLowerCase().includes(lowerQuery)
      )
    } else if (activeTab === 'reservations') {
      return data.filter(item =>
        item.company_name?.toLowerCase().includes(lowerQuery) ||
        item.status?.toLowerCase().includes(lowerQuery)
      )
    } else if (activeTab === 'equipment') {
      return data.filter(item =>
        item.name?.toLowerCase().includes(lowerQuery) ||
        item.type?.toLowerCase().includes(lowerQuery)
      )
    }

    return data
  }

  // Companies Table
  const CompaniesTable = () => {
    const filteredData = filterData(companies, searchQuery)

    return (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>기업명</th>
              <th>대표자</th>
              <th>사업자번호</th>
              <th>업종</th>
              <th>연락처</th>
              <th>자치구</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((company) => (
              <tr key={company.id}>
                <td className="font-semibold">{company.name}</td>
                <td>{company.representative}</td>
                <td className="font-mono text-xs">{company.business_number}</td>
                <td>
                  <span className="badge badge-primary">{company.industry}</span>
                </td>
                <td className="text-sm">{company.contact}</td>
                <td>{company.district}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button className="btn-ghost text-xs px-2 py-1">수정</button>
                    <button className="btn-ghost text-xs px-2 py-1 text-danger">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="text-center py-12 text-text-tertiary">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    )
  }

  // Reservations Table
  const ReservationsTable = () => {
    const filteredData = filterData(reservations, searchQuery)

    const statusConfig = {
      confirmed: { label: '확정', class: 'badge-success' },
      pending: { label: '대기', class: 'badge-warning' },
      completed: { label: '완료', class: 'badge-primary' },
      cancelled: { label: '취소', class: 'badge-danger' },
    }

    return (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>시간대</th>
              <th>기업명</th>
              <th>업종</th>
              <th>장비</th>
              <th>인원</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((reservation) => (
              <tr key={reservation.id}>
                <td className="font-mono text-sm">{reservation.reservation_date}</td>
                <td>
                  <span className={`badge ${
                    reservation.time_slot === 'morning' ? 'badge-primary' : 'badge-success'
                  }`}>
                    {reservation.time_slot === 'morning' ? '오전' : '오후'}
                  </span>
                </td>
                <td className="font-semibold">{reservation.company_name}</td>
                <td className="text-sm text-text-secondary">{reservation.industry}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {reservation.equipment_types?.slice(0, 2).map((eq, idx) => (
                      <span key={idx} className="text-xs bg-bg-tertiary px-2 py-0.5 rounded">
                        {eq}
                      </span>
                    ))}
                    {reservation.equipment_types?.length > 2 && (
                      <span className="text-xs text-text-tertiary">
                        +{reservation.equipment_types.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td>{reservation.attendees}명</td>
                <td>
                  <span className={`badge ${statusConfig[reservation.status]?.class || 'badge-primary'}`}>
                    {statusConfig[reservation.status]?.label || reservation.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button className="btn-ghost text-xs px-2 py-1">수정</button>
                    <button className="btn-ghost text-xs px-2 py-1 text-danger">취소</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="text-center py-12 text-text-tertiary">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    )
  }

  // Equipment Table
  const EquipmentTable = () => {
    const filteredData = filterData(equipment, searchQuery)

    const statusConfig = {
      active: { label: '활성', class: 'badge-success' },
      maintenance: { label: '정비중', class: 'badge-warning' },
      inactive: { label: '비활성', class: 'badge-danger' },
    }

    return (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>장비명</th>
              <th>타입</th>
              <th>설명</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr key={item.id}>
                <td className="font-semibold">{item.name}</td>
                <td>
                  <span className="badge badge-primary">{item.type}</span>
                </td>
                <td className="text-sm text-text-secondary max-w-xs truncate">
                  {item.description || '-'}
                </td>
                <td>
                  <span className={`badge ${statusConfig[item.status]?.class || 'badge-primary'}`}>
                    {statusConfig[item.status]?.label || item.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button className="btn-ghost text-xs px-2 py-1">수정</button>
                    <button className="btn-ghost text-xs px-2 py-1 text-danger">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="text-center py-12 text-text-tertiary">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary sticky top-0 z-10">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">관리자 페이지</h1>
              <p className="text-sm text-text-tertiary mt-1">
                데이터 관리 및 설정
              </p>
            </div>

            <button className="btn btn-primary">
              ➕ 새로 만들기
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 flex items-center gap-2 border-t border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-primary text-text-primary font-semibold'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="bg-bg-tertiary px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="p-8">
        {/* Search and Filters */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="btn btn-ghost">
              🔽 필터
            </button>
            <button className="btn btn-ghost" onClick={fetchData}>
              🔄 새로고침
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="skeleton h-64 w-full" />
            </div>
          ) : (
            <>
              {activeTab === 'companies' && <CompaniesTable />}
              {activeTab === 'reservations' && <ReservationsTable />}
              {activeTab === 'equipment' && <EquipmentTable />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminPage
