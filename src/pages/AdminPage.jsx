import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { api } from '../lib/supabase'
import { exportCompanies, exportReservations, exportEquipment } from '../lib/exportUtils'
import Modal from '../components/Modal'
import ReservationForm from '../components/ReservationForm'
import CompanyForm from '../components/CompanyForm'
import { useToast } from '../components/Toast'

const AdminPage = () => {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('companies')
  const [companies, setCompanies] = useState([])
  const [blockedCompanies, setBlockedCompanies] = useState([])
  const [reservations, setReservations] = useState([])
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState(null)
  const [editingCompany, setEditingCompany] = useState(null)

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)

    if (activeTab === 'companies') {
      const { data } = await api.companies.getAll()
      setCompanies(data || [])
    } else if (activeTab === 'blocked') {
      const { data } = await api.companies.getBlocked()
      setBlockedCompanies(data || [])
    } else if (activeTab === 'reservations') {
      const { data } = await api.reservations.getAll()
      setReservations(data || [])
    } else if (activeTab === 'equipment') {
      const { data } = await api.equipment.getAll()
      setEquipment(data || [])
    }

    setLoading(false)
  }

  const handleNoShow = async (reservationId, companyId) => {
    if (!confirm('이 예약을 노쇼 처리하시겠습니까?\n해당 기업은 1주일간 예약이 제한됩니다.')) {
      return
    }

    const { error } = await api.reservations.markNoShow(reservationId, companyId)
    if (error) {
      toast.error('노쇼 처리 실패: ' + error.message)
    } else {
      toast.warning('노쇼 처리 완료. 해당 기업은 1주일간 예약이 제한됩니다.')
      fetchData()
    }
  }

  const handleUnblock = async (companyId) => {
    if (!confirm('이 기업의 예약 제한을 해제하시겠습니까?')) {
      return
    }

    const { error } = await api.companies.unblock(companyId)
    if (error) {
      toast.error('차단 해제 실패: ' + error.message)
    } else {
      toast.success('예약 제한이 해제되었습니다.')
      fetchData()
    }
  }

  // Reservation CRUD handlers
  const handleAddReservation = () => {
    setEditingReservation(null)
    setShowReservationModal(true)
  }

  const handleEditReservation = (reservation) => {
    setEditingReservation(reservation)
    setShowReservationModal(true)
  }

  const handleReservationSaved = () => {
    setShowReservationModal(false)
    setEditingReservation(null)
    fetchData()
  }

  const handleCancelReservation = async (id) => {
    if (!confirm('이 예약을 취소하시겠습니까?')) {
      return
    }

    const { error } = await api.reservations.cancel(id)
    if (error) {
      toast.error('예약 취소 실패: ' + error.message)
    } else {
      toast.success('예약이 취소되었습니다.')
      fetchData()
    }
  }

  const handleDeleteReservation = async (id) => {
    if (!confirm('이 예약을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    const { error } = await api.reservations.delete(id)
    if (error) {
      toast.error('예약 삭제 실패: ' + error.message)
    } else {
      toast.success('예약이 삭제되었습니다.')
      fetchData()
    }
  }

  // Company CRUD handlers
  const handleAddCompany = () => {
    setEditingCompany(null)
    setShowCompanyModal(true)
  }

  const handleEditCompany = (company) => {
    setEditingCompany(company)
    setShowCompanyModal(true)
  }

  const handleCompanySaved = () => {
    setShowCompanyModal(false)
    setEditingCompany(null)
    fetchData()
  }

  const handleDeleteCompany = async (id) => {
    if (!confirm('이 기업을 삭제하시겠습니까? 관련된 모든 예약도 삭제됩니다.')) {
      return
    }

    const { error } = await api.companies.delete(id)
    if (error) {
      toast.error('기업 삭제 실패: ' + error.message)
    } else {
      toast.success('기업이 삭제되었습니다.')
      fetchData()
    }
  }

  // "새로 만들기" 버튼 핸들러
  const handleCreate = () => {
    if (activeTab === 'companies') {
      handleAddCompany()
    } else if (activeTab === 'reservations') {
      handleAddReservation()
    }
  }

  // Export handler
  const handleExport = () => {
    if (activeTab === 'companies') {
      exportCompanies(companies)
      toast.success('기업 목록을 내보냈습니다.')
    } else if (activeTab === 'reservations') {
      exportReservations(reservations)
      toast.success('예약 목록을 내보냈습니다.')
    } else if (activeTab === 'equipment') {
      exportEquipment(equipment)
      toast.success('장비 목록을 내보냈습니다.')
    }
  }

  const tabs = [
    { id: 'companies', label: '기업 관리', icon: '🏢', count: companies.length },
    { id: 'blocked', label: '차단 기업', icon: '🚫', count: blockedCompanies.length },
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
                    <button
                      onClick={() => handleEditCompany(company)}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(company.id)}
                      className="btn-ghost text-xs px-2 py-1 text-danger"
                    >
                      삭제
                    </button>
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
      no_show: { label: '노쇼', class: 'bg-red-900/50 text-red-300 border-red-500/30' },
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
              <tr key={reservation.id} className={reservation.status === 'no_show' ? 'bg-red-900/10' : ''}>
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
                    {reservation.status === 'confirmed' && (
                      <button
                        onClick={() => handleNoShow(reservation.id, reservation.company_id)}
                        className="btn-ghost text-xs px-2 py-1 text-warning hover:bg-warning/20"
                      >
                        노쇼
                      </button>
                    )}
                    <button
                      onClick={() => handleEditReservation(reservation)}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      수정
                    </button>
                    {reservation.status !== 'cancelled' && reservation.status !== 'no_show' && (
                      <button
                        onClick={() => handleCancelReservation(reservation.id)}
                        className="btn-ghost text-xs px-2 py-1 text-danger"
                      >
                        취소
                      </button>
                    )}
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

  // Blocked Companies Table
  const BlockedCompaniesTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>기업명</th>
              <th>대표자</th>
              <th>연락처</th>
              <th>차단 해제일</th>
              <th>남은 기간</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {blockedCompanies.map((company) => {
              const blockedUntil = new Date(company.blocked_until)
              const now = new Date()
              const daysRemaining = Math.ceil((blockedUntil - now) / (1000 * 60 * 60 * 24))

              return (
                <tr key={company.id} className="bg-red-900/5">
                  <td className="font-semibold">{company.name}</td>
                  <td>{company.representative || '-'}</td>
                  <td className="text-sm">{company.contact || '-'}</td>
                  <td className="font-mono text-sm">
                    {format(blockedUntil, 'yyyy-MM-dd HH:mm', { locale: ko })}
                  </td>
                  <td>
                    <span className="badge bg-red-900/50 text-red-300 border-red-500/30">
                      {daysRemaining}일 남음
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleUnblock(company.id)}
                      className="btn-ghost text-xs px-2 py-1 text-success hover:bg-success/20"
                    >
                      차단 해제
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {blockedCompanies.length === 0 && (
          <div className="text-center py-12 text-text-tertiary">
            차단된 기업이 없습니다.
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

            {(activeTab === 'companies' || activeTab === 'reservations') && (
              <button onClick={handleCreate} className="btn btn-primary">
                + {activeTab === 'companies' ? '기업 추가' : '예약 추가'}
              </button>
            )}
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
            {activeTab !== 'blocked' && (
              <button className="btn btn-ghost" onClick={handleExport}>
                📥 내보내기
              </button>
            )}
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
              {activeTab === 'blocked' && <BlockedCompaniesTable />}
              {activeTab === 'reservations' && <ReservationsTable />}
              {activeTab === 'equipment' && <EquipmentTable />}
            </>
          )}
        </div>
      </div>

      {/* Reservation Modal */}
      <Modal
        isOpen={showReservationModal}
        onClose={() => {
          setShowReservationModal(false)
          setEditingReservation(null)
        }}
        title={editingReservation ? '예약 수정' : '새 예약 추가'}
        size="lg"
      >
        <ReservationForm
          reservation={editingReservation}
          onSave={handleReservationSaved}
          onCancel={() => {
            setShowReservationModal(false)
            setEditingReservation(null)
          }}
        />
      </Modal>

      {/* Company Modal */}
      <Modal
        isOpen={showCompanyModal}
        onClose={() => {
          setShowCompanyModal(false)
          setEditingCompany(null)
        }}
        title={editingCompany ? '기업 정보 수정' : '새 기업 추가'}
        size="lg"
      >
        <CompanyForm
          company={editingCompany}
          onSave={handleCompanySaved}
          onCancel={() => {
            setShowCompanyModal(false)
            setEditingCompany(null)
          }}
        />
      </Modal>
    </div>
  )
}

export default AdminPage
