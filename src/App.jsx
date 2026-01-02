import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import MainPage from './pages/MainPage'
import StatsPage from './pages/StatsPage'
import AdminPage from './pages/AdminPage'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/main" replace />} />
              <Route path="main" element={<MainPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Routes>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
