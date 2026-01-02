import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { api, supabase } from '../lib/supabase'
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
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)
  const [editingReservation, setEditingReservation] = useState(null)
  const [editingCompany, setEditingCompany] = useState(null)
  const [editingEquipment, setEditingEquipment] = useState(null)

  // Confirm modal states
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'warning', // 'warning' | 'danger' | 'info'
    onConfirm: null,
  })

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

  const handleNoShow = (reservationId, companyId) => {
    if (!companyId) {
      toast.error('노쇼 처리 실패: 기업 정보를 찾을 수 없습니다.')
      return
    }

    setConfirmModal({
      show: true,
      title: '노쇼 처리',
      message: '이 예약을 노쇼 처리하시겠습니까?\n해당 기업은 1주일간 예약이 제한됩니다.',
      type: 'danger',
      onConfirm: async () => {
        const { error } = await api.reservations.markNoShow(reservationId, companyId)
        if (error) {
          toast.error('노쇼 처리 실패: ' + error.message)
        } else {
          toast.warning('노쇼 처리 완료. 해당 기업은 1주일간 예약이 제한됩니다.')
          fetchData()
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      },
    })
  }

  const handleUnblock = (companyId) => {
    setConfirmModal({
      show: true,
      title: '차단 해제',
      message: '이 기업의 예약 제한을 해제하시겠습니까?',
      type: 'info',
      onConfirm: async () => {
        const { error } = await api.companies.unblock(companyId)
        if (error) {
          toast.error('차단 해제 실패: ' + error.message)
        } else {
          toast.success('예약 제한이 해제되었습니다.')
          fetchData()
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      },
    })
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

  const handleCancelReservation = (id) => {
    setConfirmModal({
      show: true,
      title: '예약 취소',
      message: '이 예약을 취소하시겠습니까?',
      type: 'warning',
      onConfirm: async () => {
        const { error } = await api.reservations.cancel(id)
        if (error) {
          toast.error('예약 취소 실패: ' + error.message)
        } else {
          toast.success('예약이 취소되었습니다.')
          fetchData()
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      },
    })
  }

  const handleDeleteReservation = (id) => {
    setConfirmModal({
      show: true,
      title: '예약 삭제',
      message: '이 예약을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      type: 'danger',
      onConfirm: async () => {
        const { error } = await api.reservations.delete(id)
        if (error) {
          toast.error('예약 삭제 실패: ' + error.message)
        } else {
          toast.success('예약이 삭제되었습니다.')
          fetchData()
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      },
    })
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

  const handleDeleteCompany = (id) => {
    setConfirmModal({
      show: true,
      title: '기업 삭제',
      message: '이 기업을 삭제하시겠습니까?\n관련된 모든 예약도 함께 삭제됩니다.',
      type: 'danger',
      onConfirm: async () => {
        const { error } = await api.companies.delete(id)
        if (error) {
          toast.error('기업 삭제 실패: ' + error.message)
        } else {
          toast.success('기업이 삭제되었습니다.')
          fetchData()
        }
        setConfirmModal(prev => ({ ...prev, show: false }))
      },
    })
  }

  // Equipment CRUD handlers
  const handleEditEquipment = (item) => {
    setEditingEquipment(item)
    setShowEquipmentModal(true)
  }

  const handleEquipmentStatusChange = async (id, newStatus) => {
    const { error } = await supabase
      .from('equipment')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      toast.error('상태 변경 실패: ' + error.message)
    } else {
      toast.success('장비 상태가 변경되었습니다.')
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

  // SVG 아이콘
  const BuildingIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
      <path d="M9 22v-4h6v4"/>
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>
    </svg>
  )

  const BlockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  )

  const CalendarIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )

  const ToolIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )

  const tabs = [
    { id: 'companies', label: '기업 관리', icon: BuildingIcon, count: companies.length },
    { id: 'blocked', label: '차단 기업', icon: BlockIcon, count: blockedCompanies.length },
    { id: 'reservations', label: '예약 관리', icon: CalendarIcon, count: reservations.length },
    { id: 'equipment', label: '장비 관리', icon: ToolIcon, count: equipment.length },
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
                    <select
                      value={item.status}
                      onChange={(e) => handleEquipmentStatusChange(item.id, e.target.value)}
                      className="input text-xs py-1 px-2"
                    >
                      <option value="active">활성</option>
                      <option value="maintenance">정비중</option>
                      <option value="inactive">비활성</option>
                    </select>
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

  // 내보내기 아이콘
  const DownloadIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )

  // 새로고침 아이콘
  const RefreshIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header - 통계 페이지 스타일 통일 */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary">관리자 페이지</h1>
              <p className="text-xs text-text-tertiary mt-0.5">
                데이터 관리 및 설정
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* 검색 */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input text-sm py-1.5 pl-9 w-64"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>

              {/* 버튼 그룹 */}
              {activeTab !== 'blocked' && (
                <button className="btn btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5" onClick={handleExport}>
                  <DownloadIcon />
                  <span>내보내기</span>
                </button>
              )}
              <button className="btn btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5" onClick={fetchData}>
                <RefreshIcon />
                <span>새로고침</span>
              </button>
              {(activeTab === 'companies' || activeTab === 'reservations') && (
                <button onClick={handleCreate} className="btn btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>{activeTab === 'companies' ? '기업 추가' : '예약 추가'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex items-center gap-1 border-t border-border/50">
          {tabs.map((tab) => {
            const IconComponent = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchQuery('')
                }}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <IconComponent />
                <span className="text-sm">{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-bg-tertiary px-2 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">

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

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal(prev => ({ ...prev, show: false }))}
        title={confirmModal.title}
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              confirmModal.type === 'danger' ? 'bg-red-500/20' :
              confirmModal.type === 'warning' ? 'bg-yellow-500/20' :
              'bg-blue-500/20'
            }`}>
              {confirmModal.type === 'danger' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              ) : confirmModal.type === 'warning' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              )}
            </div>
            <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
              {confirmModal.message}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              className="px-4 py-2 text-sm font-medium bg-bg-tertiary hover:bg-bg-secondary border border-border rounded-lg transition-all"
            >
              취소
            </button>
            <button
              onClick={confirmModal.onConfirm}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                confirmModal.type === 'danger'
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                  : confirmModal.type === 'warning'
                  ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30'
                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30'
              }`}
            >
              확인
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AdminPage
