import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'Email not confirmed': '이메일이 인증되지 않았습니다. 관리자에게 문의하세요.',
}

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/main'

  // 이미 로그인된 상태
  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: authError } = await signIn(email, password)

    if (authError) {
      setError(ERROR_MESSAGES[authError.message] || authError.message)
      setSubmitting(false)
    } else {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

      <div className="w-full max-w-[360px] animate-fade-in relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <span className="text-xl font-bold text-primary tracking-tighter">S</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            SMBIZ Dashboard
          </h1>
          <p className="text-sm text-text-tertiary mt-1.5">
            디지털콘텐츠제작실 관리 시스템
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-bg-secondary/60 border border-border/60 rounded-2xl p-7 space-y-5 backdrop-blur-lg shadow-lg"
        >
          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-medium text-text-tertiary uppercase tracking-wider">
              이메일
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full pl-10 h-11"
                placeholder="admin@example.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-medium text-text-tertiary uppercase tracking-wider">
              비밀번호
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pl-10 h-11"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-400/8 border border-red-400/15 px-3.5 py-2.5 rounded-lg">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full h-11 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-[11px] text-text-muted text-center mt-6">
          계정이 필요하시면 관리자에게 문의하세요
        </p>
      </div>
    </div>
  )
}
