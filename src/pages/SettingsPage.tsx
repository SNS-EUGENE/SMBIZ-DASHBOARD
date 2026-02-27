import { useState, useEffect, useCallback, type ReactElement } from 'react'
import HolidayManager from '../components/HolidayManager'
import SyncManager from '../components/SyncManager'
import { api } from '../lib/supabase'

type TabId = 'sync' | 'kakaowork' | 'holidays' | 'inspector'

const SyncIcon = (): ReactElement => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0115-6.7L21 8" />
    <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 01-15 6.7L3 16" />
  </svg>
)

const KakaoWorkIcon = (): ReactElement => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 17H2a3 3 0 003 3h14a3 3 0 003-3z" />
    <path d="M6 12V7a6 6 0 0112 0v5" />
    <line x1="12" y1="20" x2="12" y2="23" />
  </svg>
)

const HolidayIcon = (): ReactElement => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <path d="M8 14l2 2 4-4"/>
  </svg>
)

const InspectorIcon = (): ReactElement => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const tabs: { id: TabId; label: string; shortLabel?: string; icon: React.FC }[] = [
  { id: 'sync', label: '예약 동기화', shortLabel: '동기화', icon: SyncIcon },
  { id: 'kakaowork', label: '카카오워크 알림', shortLabel: '알림', icon: KakaoWorkIcon },
  { id: 'holidays', label: '공휴일 관리', shortLabel: '공휴일', icon: HolidayIcon },
  { id: 'inspector', label: '확인자 설정', shortLabel: '확인자', icon: InspectorIcon },
]

// ─── 확인자 설정 ───────────────────────────────────────

const INSPECTOR_KEY = 'smbiz_inspector_name'

const InspectorSettings = (): ReactElement => {
  const [name, setName] = useState(() => localStorage.getItem(INSPECTOR_KEY) || '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    localStorage.setItem(INSPECTOR_KEY, name.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">확인자 이름</h3>
        <p className="text-xs text-text-tertiary mb-3">
          엑셀 보고서의 관리 일지(시설/장비 점검) 시트에 표시될 확인자 이름입니다.
        </p>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="input text-sm py-1.5 px-3 w-48"
          />
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary text-xs py-1.5 px-3"
          >
            {saved ? '저장됨' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 카카오워크 알림 설정 ───────────────────────────────

interface KakaoWorkRecipients {
  emails: string[]
}

const KakaoWorkSettings = (): ReactElement => {
  const [emails, setEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRecipients = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: fetchError } = await api.settings.get<KakaoWorkRecipients>('kakaowork_recipients')
      if (fetchError) {
        // settings 테이블이 없을 수 있음 (42P01)
        if (fetchError.code === '42P01') {
          setError('settings 테이블이 생성되지 않았습니다. SQL을 먼저 실행해주세요.')
        } else if (fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows → 정상 (아직 설정 없음)
          console.error('Settings load error:', fetchError)
        }
        setEmails([])
      } else if (data) {
        setEmails(data.emails || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecipients()
  }, [loadRecipients])

  const handleAddEmail = () => {
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed) return

    // 간단한 이메일 형식 체크
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setError('올바른 이메일 형식이 아닙니다.')
      return
    }

    if (emails.includes(trimmed)) {
      setError('이미 추가된 이메일입니다.')
      return
    }

    setEmails([...emails, trimmed])
    setNewEmail('')
    setError(null)
    setSaved(false)
  }

  const handleRemoveEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { error: saveError } = await api.settings.set<KakaoWorkRecipients>('kakaowork_recipients', { emails })
      if (saveError) {
        setError(`저장 실패: ${saveError.message}`)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddEmail()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-tertiary py-8">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        로딩 중...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 설명 */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">카카오워크 알림 수신자</h3>
        <p className="text-xs text-text-tertiary mb-1">
          예약 동기화 시 신규 예약/상태 변경 건이 감지되면, 아래 이메일의 카카오워크 계정으로 알림이 발송됩니다.
        </p>
        <p className="text-xs text-text-muted">
          카카오워크에 등록된 이메일 주소를 입력하세요. Bot API Key는 Supabase Edge Function Secret에 설정해야 합니다.
        </p>
      </div>

      {/* 이메일 입력 */}
      <div className="flex items-center gap-2">
        <input
          value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); setError(null) }}
          onKeyDown={handleKeyDown}
          placeholder="email@kakaowork.com"
          className="input text-sm py-1.5 px-3 flex-1 max-w-xs"
          type="email"
        />
        <button
          type="button"
          onClick={handleAddEmail}
          disabled={!newEmail.trim()}
          className="btn btn-secondary text-xs py-1.5 px-3"
        >
          추가
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      {/* 수신자 목록 */}
      {emails.length > 0 ? (
        <div className="space-y-1.5">
          {emails.map((email) => (
            <div
              key={email}
              className="flex items-center justify-between bg-bg-tertiary/40 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                <span className="text-sm text-text-primary">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveEmail(email)}
                className="text-text-tertiary hover:text-danger transition-colors text-xs px-1.5"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted py-2">
          등록된 수신자가 없습니다. 이메일을 추가하면 카카오워크 알림이 활성화됩니다.
        </p>
      )}

      {/* 저장 버튼 */}
      <div className="pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary text-xs py-1.5 px-4"
        >
          {saving ? '저장 중...' : saved ? '저장됨' : '수신자 목록 저장'}
        </button>
      </div>

      {/* 알림 종류 안내 */}
      <div className="border-t border-border/40 pt-4 mt-4">
        <p className="text-xs font-medium text-text-secondary mb-2">발송되는 알림 종류</p>
        <ul className="text-xs text-text-tertiary space-y-1">
          <li className="flex items-center gap-2">
            <span className="text-blue-400">📅</span>
            신규 예약 감지 (동기화 시)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-yellow-400">🔄</span>
            예약 상태 변경 (확정/취소 등)
          </li>
        </ul>
      </div>
    </div>
  )
}

// ─── 메인 설정 페이지 ───────────────────────────────────

const SettingsPage = (): ReactElement => {
  const [activeTab, setActiveTab] = useState<TabId>('sync')

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/60 backdrop-blur-xl flex-shrink-0 z-10">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-text-primary">설정</h1>
              <p className="text-xs text-text-tertiary mt-0.5 hidden md:block">시스템 설정 관리</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 md:px-6 flex items-center gap-1 border-t border-border/50 overflow-x-auto">
          {tabs.map((tab) => {
            const IconComponent = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <IconComponent />
                <span className="text-xs md:text-sm hidden md:inline">{tab.label}</span>
                <span className="text-xs md:hidden">{tab.shortLabel || tab.label}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-3 md:p-6 flex flex-col overflow-hidden">
        <div className="card p-0 overflow-hidden flex-1 flex flex-col min-h-0">
          {activeTab === 'sync' && (
            <div className="p-3 md:p-6 flex-1 overflow-y-auto min-h-0">
              <SyncManager />
            </div>
          )}
          {activeTab === 'kakaowork' && (
            <div className="p-3 md:p-6 flex-1 overflow-y-auto min-h-0">
              <KakaoWorkSettings />
            </div>
          )}
          {activeTab === 'holidays' && (
            <div className="p-3 md:p-6 flex-1 flex flex-col min-h-0">
              <HolidayManager />
            </div>
          )}
          {activeTab === 'inspector' && (
            <div className="p-3 md:p-6">
              <InspectorSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
