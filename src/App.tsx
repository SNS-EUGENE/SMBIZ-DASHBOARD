import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import MainPage from './pages/MainPage'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'

const StatsPage = lazy(() => import('./pages/StatsPage'))
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'))
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'))
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'))
const InspectionsPage = lazy(() => import('./pages/InspectionsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SurveysPage = lazy(() => import('./pages/SurveysPage'))
const SurveyPage = lazy(() => import('./pages/SurveyPage'))

const PageLoading = () => (
  <div className="flex items-center justify-center h-full min-h-screen">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      <span className="text-sm text-text-tertiary">로딩 중...</span>
    </div>
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public: Login */}
              <Route path="/login" element={<LoginPage />} />

              {/* Public: Survey (no auth required) */}
              <Route path="/survey" element={
                <Suspense fallback={<PageLoading />}>
                  <SurveyPage />
                </Suspense>
              } />

              {/* Protected: Dashboard (with Layout) */}
              <Route path="/" element={
                <ProtectedRoute><Layout /></ProtectedRoute>
              }>
                <Route index element={<Navigate to="/main" replace />} />
                <Route path="main" element={<MainPage />} />
                <Route path="stats" element={
                  <Suspense fallback={<PageLoading />}>
                    <StatsPage />
                  </Suspense>
                } />
                <Route path="reservations" element={
                  <Suspense fallback={<PageLoading />}>
                    <ReservationsPage />
                  </Suspense>
                } />
                <Route path="companies" element={
                  <Suspense fallback={<PageLoading />}>
                    <CompaniesPage />
                  </Suspense>
                } />
                <Route path="equipment" element={
                  <Suspense fallback={<PageLoading />}>
                    <EquipmentPage />
                  </Suspense>
                } />
                <Route path="inspections" element={
                  <Suspense fallback={<PageLoading />}>
                    <InspectionsPage />
                  </Suspense>
                } />
                <Route path="surveys" element={
                  <Suspense fallback={<PageLoading />}>
                    <SurveysPage />
                  </Suspense>
                } />
                <Route path="settings" element={
                  <Suspense fallback={<PageLoading />}>
                    <SettingsPage />
                  </Suspense>
                } />
                <Route path="admin" element={<Navigate to="/settings" replace />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
