import { useState, useEffect, useRef, Fragment, type ReactElement } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { api, supabase } from '../lib/supabase'
import { exportCompanies } from '../lib/exportUtils'
import Modal from '../components/Modal'
import CompanyForm, { COMPANY_FORM_ID } from '../components/CompanyForm'
import { useToast } from '../components/Toast'
import type { Company } from '../types'

interface CompanyStats {
  count: number
  lastDate: string
}

type TabId = 'list' | 'blocked'

interface ConfirmModalState {
  show: boolean
  title: string
  message: string
  type: 'warning' | 'danger' | 'info'
  onConfirm: (() => Promise<void>) | null
}

const CompaniesPage = (): ReactElement => {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabId>('list')
  const [companies, setCompanies] = useState<Company[]>([])
  const [blockedCompanies, setBlockedCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [allReservations, setAllReservations] = useState<{ company_id: string; reservation_date: string }[]>([])
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [companyStats, setCompanyStats] = useState<Map<string, CompanyStats>>(new Map())
  const [allTimeStats, setAllTimeStats] = useState<Map<string, CompanyStats>>(new Map())
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    show: false, title: '', message: '', type: 'warning', onConfirm: null,
  })

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const handleSearchChange = (value: string): void => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  // 예약 데이터에서 연도별 통계 계산
  const computeStats = (
    reservations: { company_id: string; reservation_date: string }[],
    year: number | 'all'
  ): Map<string, CompanyStats> => {
    const filtered = year === 'all'
      ? reservations
      : reservations.filter((r) => r.reservation_date.startsWith(String(year)))
    const statsMap = new Map<string, CompanyStats>()
    filtered.forEach((r) => {
      const existing = statsMap.get(r.company_id)
      if (existing) {
        existing.count++
        if (r.reservation_date > existing.lastDate) existing.lastDate = r.reservation_date
      } else {
        statsMap.set(r.company_id, { count: 1, lastDate: r.reservation_date })
      }
    })
    return statsMap
  }

  // 사용 가능한 연도 목록
  const availableYears = (() => {
    const years = new Set<number>()
    allReservations.forEach((r) => {
      const y = parseInt(r.reservation_date.substring(0, 4))
      if (!isNaN(y)) years.add(y)
    })
    return Array.from(years).sort((a, b) => b - a)
  })()

  // 연도 변경 시 stats 재계산
  useEffect(() => {
    if (allReservations.length > 0) {
      setCompanyStats(computeStats(allReservations, selectedYear))
    }
  }, [selectedYear, allReservations])

  const fetchData = async (): Promise<void> => {
    setLoading(true)
    try {
      if (activeTab === 'list') {
        const [companyResult, reservationResult] = await Promise.all([
          api.companies.getAll(),
          supabase
            .from('reservations')
            .select('company_id, reservation_date')
            .not('status', 'eq', 'cancelled'),
        ])

        if (companyResult.error) toast.error('기업 목록 조회 실패 : ' + companyResult.error.message)
        else setCompanies(companyResult.data || [])

        const rows = (reservationResult.data || []) as { company_id: string; reservation_date: string }[]
        setAllReservations(rows)
        setAllTimeStats(computeStats(rows, 'all'))
        setCompanyStats(computeStats(rows, selectedYear))
      } else {
        const { data, error } = await api.companies.getBlocked()
        if (error) toast.error('차단 기업 조회 실패 : ' + error.message)
        else setBlockedCompanies(data || [])
      }
    } catch (err: unknown) {
      toast.error('데이터 조회 중 오류가 발생했습니다 : ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setLoading(false)
  }

  const handleAddCompany = (): void => {
    setEditingCompany(null)
    setShowCompanyModal(true)
  }

  const handleEditCompany = (company: Company): void => {
    setEditingCompany(company)
    setShowCompanyModal(true)
  }

  const handleCompanySaved = (): void => {
    setShowCompanyModal(false)
    setEditingCompany(null)
    fetchData()
  }

  const handleDeleteCompany = (id: string): void => {
    setConfirmModal({
      show: true,
      title: '기업 삭제',
      message: '이 기업을 삭제하시겠습니까?\n관련된 모든 예약도 함께 삭제됩니다.',
      type: 'danger',
      onConfirm: async () => {
        const { error } = await api.companies.delete(id)
        if (error) toast.error('기업 삭제 실패 : ' + error.message)
        else { toast.success('기업이 삭제되었습니다.'); fetchData() }
        setConfirmModal((prev) => ({ ...prev, show: false }))
      },
    })
  }

  const handleUnblock = (companyId: string): void => {
    setConfirmModal({
      show: true,
      title: '차단 해제',
      message: '이 기업의 예약 제한을 해제하시겠습니까?',
      type: 'info',
      onConfirm: async () => {
        const { error } = await api.companies.unblock(companyId)
        if (error) toast.error('차단 해제 실패 : ' + error.message)
        else { toast.success('예약 제한이 해제되었습니다.'); fetchData() }
        setConfirmModal((prev) => ({ ...prev, show: false }))
      },
    })
  }

  const handleExport = (): void => {
    try {
      exportCompanies(companies)
      toast.success('기업 목록을 내보냈습니다.')
    } catch (error: unknown) {
      toast.error('내보내기 실패 : ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Filter
  const matchField = (value: unknown, query: string): boolean =>
    typeof value === 'string' && value.toLowerCase().includes(query)

  const filterCompanies = (data: Company[], query: string): Company[] => {
    if (!query) return data
    const q = query.toLowerCase()
    return data.filter((item) =>
      matchField(item.name, q) ||
      matchField(item.representative, q) ||
      matchField(item.industry, q) ||
      matchField(item.contact, q)
    )
  }

  const filterBlocked = (data: Company[], query: string): Company[] => {
    if (!query) return data
    const q = query.toLowerCase()
    return data.filter((item) =>
      matchField(item.name, q) ||
      matchField(item.representative, q) ||
      matchField(item.contact, q)
    )
  }

  // Expandable row state (mobile)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Sort state
  type SortField = 'count' | 'lastDate' | null
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const SortArrow = ({ field }: { field: SortField }): ReactElement | null => {
    if (sortField !== field) return (
      <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-30 ml-0.5 inline-block">
        <path d="M5 2L8 5H2L5 2Z" fill="currentColor"/><path d="M5 8L2 5H8L5 8Z" fill="currentColor"/>
      </svg>
    )
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" className="ml-0.5 inline-block text-primary">
        {sortOrder === 'asc'
          ? <path d="M5 2L8 6H2L5 2Z" fill="currentColor"/>
          : <path d="M5 8L2 4H8L5 8Z" fill="currentColor"/>}
      </svg>
    )
  }

  const sortCompanies = (data: Company[]): Company[] => {
    if (!sortField) return data
    return [...data].sort((a, b) => {
      let cmp = 0
      if (sortField === 'count') {
        // 예약 횟수는 항상 누계 기준
        const sa = allTimeStats.get(a.id)
        const sb = allTimeStats.get(b.id)
        cmp = (sa?.count ?? 0) - (sb?.count ?? 0)
      } else {
        // 최근 예약은 연도 필터 기준
        const sa = companyStats.get(a.id)
        const sb = companyStats.get(b.id)
        const da = sa?.lastDate ?? ''
        const db = sb?.lastDate ?? ''
        cmp = da.localeCompare(db)
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }

  // Tables
  // 연도 필터 적용: 특정 연도 선택 시 해당 연도에 예약이 있는 기업만 표시
  const yearFilteredCompanies = selectedYear === 'all'
    ? companies
    : companies.filter((c) => companyStats.has(c.id))

  const CompaniesTable = (): ReactElement => {
    const filteredData = sortCompanies(filterCompanies(yearFilteredCompanies, debouncedSearch))
    return (
      <div className="overflow-x-auto">
        <table className="table text-sm w-full">
          <thead className="sticky top-0 z-10 bg-bg-secondary">
            <tr>
              <th className="col-left">기업명</th>
              <th className="col-left">대표자</th>
              <th className="col-left hidden md:table-cell">사업자번호</th>
              <th className="col-left hidden md:table-cell">업종</th>
              <th className="col-left">연락처</th>
              <th className="col-center hidden md:table-cell cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleSort('count')}>
                예약 횟수 <SortArrow field="count" />
              </th>
              <th className="col-left hidden md:table-cell cursor-pointer select-none hover:text-primary transition-colors" onClick={() => toggleSort('lastDate')}>
                최근 예약 <SortArrow field="lastDate" />
              </th>
              <th className="col-center">작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((company) => {
              const isExpanded = expandedId === company.id
              const totalStats = allTimeStats.get(company.id)
              const yearStats = companyStats.get(company.id)
              return (
                <Fragment key={company.id}>
                  <tr
                    className="md:cursor-default cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : company.id)}
                  >
                    <td className="col-left font-semibold whitespace-nowrap">{company.name}</td>
                    <td className="col-left whitespace-nowrap">{company.representative || '-'}</td>
                    <td className="col-left font-mono text-xs hidden md:table-cell">{company.business_number}</td>
                    <td className="col-left hidden md:table-cell">
                      <span className="badge badge-primary">{company.industry}</span>
                    </td>
                    <td className="col-left whitespace-nowrap">{company.contact || '-'}</td>
                    <td className="col-center hidden md:table-cell tabular-nums">
                      {totalStats ? (
                        <span className="font-semibold">{totalStats.count}</span>
                      ) : (
                        <span className="text-text-tertiary">0</span>
                      )}
                    </td>
                    <td className="col-left hidden md:table-cell text-xs tabular-nums text-text-secondary">
                      {yearStats ? format(new Date(yearStats.lastDate), 'yy.MM.dd') : '-'}
                    </td>
                    <td className="col-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1">
                        <button onClick={() => handleEditCompany(company)} className="btn-ghost text-xs px-1.5 py-0.5">수정</button>
                        <button onClick={() => handleDeleteCompany(company.id)} className="btn-ghost text-xs px-1.5 py-0.5 text-danger">삭제</button>
                      </div>
                    </td>
                  </tr>
                  {/* Mobile expanded detail row */}
                  {isExpanded && (
                    <tr className="md:hidden bg-bg-tertiary/20">
                      <td colSpan={4} className="px-4 py-2.5 text-xs space-y-1.5">
                        {company.business_number && (
                          <div className="flex gap-2">
                            <span className="text-text-tertiary w-16 flex-shrink-0">사업자번호</span>
                            <span className="text-text-primary font-mono">{company.business_number}</span>
                          </div>
                        )}
                        {company.industry && (
                          <div className="flex gap-2 items-center">
                            <span className="text-text-tertiary w-16 flex-shrink-0">업종</span>
                            <span className="badge badge-primary text-[10px]">{company.industry}</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <span className="text-text-tertiary w-16 flex-shrink-0">예약</span>
                          <span className="text-text-primary">
                            {totalStats ? `${totalStats.count}건` : '0건'}
                            {yearStats ? ` (최근 ${format(new Date(yearStats.lastDate), 'yy.MM.dd')})` : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="text-center py-12 text-text-tertiary">검색 결과가 없습니다.</div>
        )}
      </div>
    )
  }

  const BlockedCompaniesTable = (): ReactElement => {
    const filteredData = filterBlocked(blockedCompanies, debouncedSearch)
    return (
      <div className="overflow-x-auto">
        <table className="table text-sm w-full">
          <thead className="sticky top-0 z-10 bg-bg-secondary">
            <tr>
              <th className="col-left">기업명</th>
              <th className="col-left">대표자</th>
              <th className="col-left">연락처</th>
              <th className="col-left">차단 해제일</th>
              <th className="col-center">남은 기간</th>
              <th className="col-center">작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((company) => {
              const blockedUntil = new Date(company.blocked_until!)
              const now = new Date()
              const daysRemaining = Math.ceil((blockedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              return (
                <tr key={company.id} className="bg-red-900/5">
                  <td className="col-left font-semibold">{company.name}</td>
                  <td className="col-left">{company.representative || '-'}</td>
                  <td className="col-left">{company.contact || '-'}</td>
                  <td className="col-left font-mono text-xs">
                    {format(blockedUntil, 'yyyy-MM-dd HH:mm', { locale: ko })}
                  </td>
                  <td className="col-center">
                    <span className="badge text-[10px] bg-red-900/50 text-red-300 border-red-500/30">
                      {daysRemaining}일 남음
                    </span>
                  </td>
                  <td className="col-center">
                    <button onClick={() => handleUnblock(company.id)} className="btn-ghost text-[10px] px-1.5 py-0.5 text-success whitespace-nowrap">
                      차단 해제
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredData.length === 0 && (
          <div className="text-center py-12 text-text-tertiary">
            {searchQuery ? '검색 결과가 없습니다.' : '차단된 기업이 없습니다.'}
          </div>
        )}
      </div>
    )
  }

  // Icons
  const BuildingIcon = (): ReactElement => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
      <path d="M9 22v-4h6v4"/>
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>
    </svg>
  )

  const BlockIcon = (): ReactElement => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  )

  const DownloadIcon = (): ReactElement => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )

  const RefreshIcon = (): ReactElement => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )

  const tabs = [
    { id: 'list' as TabId, label: '기업 목록', icon: BuildingIcon, count: yearFilteredCompanies.length },
    { id: 'blocked' as TabId, label: '차단 기업', icon: BlockIcon, count: blockedCompanies.length },
  ]

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-text-primary">기업 관리</h1>
              <p className="text-xs text-text-tertiary mt-0.5 hidden md:block">기업 정보 관리 및 차단 기업 관리</p>
            </div>

            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <div className="relative hidden md:block">
                <input
                  type="text"
                  placeholder="검색..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="input text-sm py-1.5 pl-9 w-52 lg:w-64"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>

              {activeTab === 'list' && (
                <button className="btn btn-ghost text-sm p-1.5 md:py-1.5 md:px-3 flex items-center gap-1.5" onClick={handleExport} aria-label="내보내기">
                  <DownloadIcon />
                  <span className="hidden md:inline">내보내기</span>
                </button>
              )}
              <button className="btn btn-ghost text-sm p-1.5 md:py-1.5 md:px-3 flex items-center gap-1.5" onClick={fetchData} aria-label="새로고침">
                <RefreshIcon />
                <span className="hidden md:inline">새로고침</span>
              </button>
              {activeTab === 'list' && (
                <button onClick={handleAddCompany} className="btn btn-primary text-sm p-1.5 md:py-1.5 md:px-3 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="hidden md:inline">기업 추가</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile search */}
          <div className="mt-2 md:hidden relative">
            <input
              type="text"
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input text-sm py-1.5 pl-9 w-full"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>

        {/* Tabs + Year filter */}
        <div className="px-4 md:px-6 flex items-center gap-0.5 md:gap-1 border-t border-border/50 overflow-x-auto">
          {tabs.map((tab) => {
            const IconComponent = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchQuery('')
                  setDebouncedSearch('')
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                }}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-3 border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <IconComponent />
                <span className="text-xs md:text-sm">{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-bg-tertiary px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs">{tab.count}</span>
                )}
              </button>
            )
          })}

          {/* Year filter (기업 목록 탭일 때만) */}
          {activeTab === 'list' && availableYears.length > 0 && (
            <div className="ml-auto flex items-center gap-1 pl-4">
              <button
                onClick={() => { setSelectedYear('all'); setSortField(null) }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  selectedYear === 'all'
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                전체
              </button>
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => { setSelectedYear(year); setSortField('lastDate'); setSortOrder('desc') }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium tabular-nums transition-all ${
                    selectedYear === year
                      ? 'bg-primary/20 text-primary'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-3 md:p-6 flex flex-col min-h-0 overflow-hidden">
        <div className="card p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><div className="skeleton h-64 w-full" /></div>
          ) : (
            <div className="flex-1 overflow-auto min-h-0">
              {activeTab === 'list' && <CompaniesTable />}
              {activeTab === 'blocked' && <BlockedCompaniesTable />}
            </div>
          )}
        </div>
      </div>

      {/* Company Modal */}
      <Modal
        isOpen={showCompanyModal}
        onClose={() => { setShowCompanyModal(false); setEditingCompany(null) }}
        title={editingCompany ? '기업 정보 수정' : '새 기업 추가'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowCompanyModal(false); setEditingCompany(null) }} className="btn btn-ghost" disabled={formLoading}>취소</button>
            <button type="submit" form={COMPANY_FORM_ID} className="btn btn-primary" disabled={formLoading}>
              {formLoading ? '저장 중...' : (editingCompany ? '수정' : '추가')}
            </button>
          </div>
        }
      >
        <CompanyForm
          company={editingCompany}
          onSave={handleCompanySaved}
          onLoadingChange={setFormLoading}
        />
      </Modal>

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal((prev) => ({ ...prev, show: false }))}
        title={confirmModal.title}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmModal((prev) => ({ ...prev, show: false }))}
              className="px-4 py-2 text-sm font-medium bg-bg-tertiary hover:bg-bg-secondary border border-border rounded-lg transition-all"
            >취소</button>
            <button
              onClick={confirmModal.onConfirm ?? undefined}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                confirmModal.type === 'danger'
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                  : confirmModal.type === 'warning'
                  ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30'
                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30'
              }`}
            >확인</button>
          </div>
        }
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              confirmModal.type === 'danger' ? 'bg-red-500/20' :
              confirmModal.type === 'warning' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
            }`}>
              {confirmModal.type === 'danger' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              ) : confirmModal.type === 'warning' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              )}
            </div>
            <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{confirmModal.message}</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CompaniesPage
