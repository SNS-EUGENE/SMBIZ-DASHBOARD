import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo })
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/main'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-6 opacity-50">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
                <circle cx="40" cy="40" r="36" stroke="#FF6B6B" strokeWidth="4" strokeDasharray="8 4"/>
                <path d="M40 24V44M40 52V56" stroke="#FF6B6B" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-text-primary mb-3">
              오류가 발생했습니다
            </h1>

            <p className="text-text-secondary mb-6">
              예기치 않은 오류가 발생했습니다. 페이지를 새로고침하거나 홈으로 이동해주세요.
            </p>

            {this.state.error && !import.meta.env.PROD && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-text-tertiary cursor-pointer hover:text-text-secondary">
                  오류 상세 정보
                </summary>
                <pre className="mt-2 p-4 bg-bg-tertiary rounded-lg text-xs text-danger overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex items-center justify-center gap-4">
              <button onClick={this.handleReload} className="btn btn-primary">
                새로고침
              </button>
              <button onClick={this.handleGoHome} className="btn btn-secondary">
                홈으로 이동
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
