import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { supabase } from '../lib/supabase'
import { fmtNum } from '../lib/utils'

interface SyncLog {
  id: string
  started_at: string
  completed_at: string | null
  mode: string
  new_count: number
  error_count: number
  status: string
  details: unknown
}

interface SyncStats {
  totalReservations: number
  lastReserveIdx: string | null
}

const SyncManager = (): ReactElement => {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<SyncStats>({ totalReservations: 0, lastReserveIdx: null })
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [lastResult, setLastResult] = useState<{
    success: boolean
    newCount: number
    updatedCount: number
    errorCount: number
    details: string[]
  } | null>(null)

  const loadStats = useCallback(async () => {
    const { count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })

    const { data: allIdx } = await supabase
      .from('reservations')
      .select('reserve_idx')
      .not('reserve_idx', 'is', null)

    let maxIdx: string | null = null
    if (allIdx) {
      let maxNum = 0
      for (const row of allIdx) {
        const num = parseInt(row.reserve_idx)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
          maxIdx = row.reserve_idx
        }
      }
    }

    setStats({
      totalReservations: count ?? 0,
      lastReserveIdx: maxIdx,
    })
  }, [])

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(8)

    if (data) setLogs(data)
  }, [])

  useEffect(() => {
    loadStats()
    loadLogs()
  }, [loadStats, loadLogs])

  const handleSync = async (mode: 'incremental' | 'full') => {
    setLoading(true)
    setLastResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('sync-reservations', {
        body: { mode },
      })

      if (error) {
        setLastResult({
          success: false,
          newCount: 0,
          errorCount: 1,
          details: [error.message],
        })
      } else {
        setLastResult(data)
      }

      await loadStats()
      await loadLogs()
    } catch (err) {
      setLastResult({
        success: false,
        newCount: 0,
        errorCount: 1,
        details: [err instanceof Error ? err.message : '알 수 없는 오류'],
      })
    } finally {
      setLoading(false)
    }
  }

  const lastSyncTime = logs[0]?.completed_at
    ? new Date(logs[0].completed_at).toLocaleString('ko-KR')
    : null

  return (
    <div className="space-y-5">
      {/* 상태 요약 + 동기화 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-text-tertiary mb-0.5">DB 예약 수</p>
            <p className="text-lg font-bold text-text-primary tabular-nums">
              {fmtNum(stats.totalReservations, 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary mb-0.5">마지막 예약번호</p>
            <p className="text-lg font-bold text-text-primary tabular-nums">
              {stats.lastReserveIdx ?? '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-tertiary mb-0.5">마지막 동기화</p>
            <p className="text-sm font-medium text-text-secondary leading-7">
              {lastSyncTime ?? '기록 없음'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => handleSync('incremental')}
            disabled={loading}
            className="btn btn-primary text-sm flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0115-6.7L21 8" />
                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 01-15 6.7L3 16" />
              </svg>
            )}
            {loading ? '동기화 중...' : '새 예약 동기화'}
          </button>
          <button
            onClick={() => handleSync('full')}
            disabled={loading}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary transition-colors"
            title="전체 재동기화 (모든 페이지 순회)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* 동기화 결과 알림 */}
      {lastResult && (
        <div className={`p-3 rounded-lg border text-sm ${
          lastResult.success
            ? 'bg-green-500/5 border-green-500/20 text-green-400'
            : 'bg-red-500/5 border-red-500/20 text-red-400'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {lastResult.success ? '동기화 완료' : '동기화 실패'}
            </span>
            <span className="text-xs opacity-75">
              +{lastResult.newCount}건
              {lastResult.updatedCount > 0 && ` / ${lastResult.updatedCount} 변경`}
              {lastResult.errorCount > 0 && ` / ${lastResult.errorCount} 에러`}
            </span>
          </div>
          {lastResult.details && lastResult.details.length > 0 && (
            <div className="mt-2 text-xs opacity-60 space-y-0.5">
              {lastResult.details.map((d, i) => <p key={i}>{d}</p>)}
            </div>
          )}
        </div>
      )}

      {/* 동기화 이력 */}
      {logs.length > 0 && (
        <div>
          <p className="text-xs text-text-tertiary mb-2">최근 동기화 이력</p>
          <div className="divide-y divide-border/30 rounded-lg border border-border/30 overflow-hidden">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2 px-3 bg-bg-tertiary/30 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <StatusDot status={log.status} />
                  <span className="text-text-secondary tabular-nums">
                    {new Date(log.started_at).toLocaleString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-text-tertiary">
                    {log.mode === 'full' ? '전체' : '증분'}
                  </span>
                </div>
                <div className="text-text-tertiary tabular-nums">
                  {log.status === 'running' ? (
                    <span className="text-yellow-400">진행 중</span>
                  ) : (
                    <>
                      <span>+{log.new_count}</span>
                      {log.error_count > 0 && (
                        <span className="text-red-400 ml-2">{log.error_count} err</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const StatusDot = ({ status }: { status: string }) => {
  const color = status === 'completed' ? 'bg-green-400'
    : status === 'failed' ? 'bg-red-400'
    : 'bg-yellow-400 animate-pulse'
  return <span className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0`} />
}

export default SyncManager
