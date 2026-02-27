import { useState, useEffect, useRef, type ReactElement } from 'react'
import { api, supabase } from '../lib/supabase'
import { exportEquipment } from '../lib/exportUtils'
import { useToast } from '../components/Toast'
import type { Equipment, StatusConfig } from '../types'

const EquipmentPage = (): ReactElement => {
  const toast = useToast()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  const handleSearchChange = (value: string): void => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  const fetchData = async (): Promise<void> => {
    setLoading(true)
    try {
      const { data, error } = await api.equipment.getAll()
      if (error) toast.error('장비 목록 조회 실패 : ' + error.message)
      else setEquipment(data || [])
    } catch (err: unknown) {
      toast.error('데이터 조회 중 오류가 발생했습니다 : ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setLoading(false)
  }

  const handleEquipmentStatusChange = async (id: string, newStatus: string): Promise<void> => {
    const { error } = await supabase
      .from('equipment')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) toast.error('상태 변경 실패 : ' + error.message)
    else { toast.success('장비 상태가 변경되었습니다.'); fetchData() }
  }

  const handleExport = (): void => {
    try {
      exportEquipment(equipment)
      toast.success('장비 목록을 내보냈습니다.')
    } catch (error: unknown) {
      toast.error('내보내기 실패 : ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Filter
  const filteredEquipment = (() => {
    if (!debouncedSearch) return equipment
    const q = debouncedSearch.toLowerCase()
    return equipment.filter((item) =>
      (typeof item.name === 'string' && item.name.toLowerCase().includes(q)) ||
      (typeof item.type === 'string' && item.type.toLowerCase().includes(q))
    )
  })()

  const statusConfig: Record<string, StatusConfig> = {
    active: { label: '활성', class: 'badge-success' },
    maintenance: { label: '정비중', class: 'badge-warning' },
    inactive: { label: '비활성', class: 'badge-danger' },
  }

  // Icons
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

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-text-primary">장비 관리</h1>
              <p className="text-xs text-text-tertiary mt-0.5 hidden md:block">촬영 장비 현황 및 상태 관리</p>
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

              <button className="btn btn-ghost text-sm p-1.5 md:py-1.5 md:px-3 flex items-center gap-1.5" onClick={handleExport} aria-label="내보내기">
                <DownloadIcon />
                <span className="hidden md:inline">내보내기</span>
              </button>
              <button className="btn btn-ghost text-sm p-1.5 md:py-1.5 md:px-3 flex items-center gap-1.5" onClick={fetchData} aria-label="새로고침">
                <RefreshIcon />
                <span className="hidden md:inline">새로고침</span>
              </button>
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
      </header>

      {/* Content */}
      <div className="flex-1 p-3 md:p-6 flex flex-col min-h-0 overflow-hidden">
        <div className="card p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><div className="skeleton h-64 w-full" /></div>
          ) : (
            <div className="flex-1 overflow-auto min-h-0">
              <table className="table text-sm w-full">
                <thead className="sticky top-0 z-10 bg-bg-secondary">
                  <tr>
                    <th className="col-left">장비명</th>
                    <th className="col-center">타입</th>
                    <th className="col-left">설명</th>
                    <th className="col-center">상태</th>
                    <th className="col-center">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipment.map((item) => (
                    <tr key={item.id}>
                      <td className="col-left font-semibold">{item.name}</td>
                      <td className="col-center">
                        <span className="badge text-[10px] badge-primary">{item.type}</span>
                      </td>
                      <td className="col-left text-text-secondary max-w-xs truncate">
                        {item.description || '-'}
                      </td>
                      <td className="col-center">
                        <span className={`badge text-[10px] ${statusConfig[item.status]?.class || 'badge-primary'}`}>
                          {statusConfig[item.status]?.label || item.status}
                        </span>
                      </td>
                      <td className="col-center">
                        <select
                          value={item.status}
                          onChange={(e) => handleEquipmentStatusChange(item.id, e.target.value)}
                          className="input text-xs py-1 px-2"
                        >
                          <option value="active">활성</option>
                          <option value="maintenance">정비중</option>
                          <option value="inactive">비활성</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredEquipment.length === 0 && (
                <div className="text-center py-12 text-text-tertiary">검색 결과가 없습니다.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EquipmentPage
