import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/auth'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Analyze from './pages/Analyze'
import Training from './pages/Training'
import Assistant from './pages/Assistant'
import History from './pages/History'
import Profile from './pages/Profile'
import Opponents from './pages/Opponents'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-poker-bg">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin inline-block">🃏</div>
          <p className="text-poker-text-muted">Загрузка...</p>
        </div>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-poker-bg">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin inline-block">🃏</div>
          <p className="text-poker-text-muted">Загрузка...</p>
        </div>
      </div>
    )
  }
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            }
          />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="analyze" element={<Analyze />} />
            <Route path="training" element={<Training />} />
            <Route path="assistant" element={<Assistant />} />
            <Route path="history" element={<History />} />
            <Route path="opponents" element={<Opponents />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
