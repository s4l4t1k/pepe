import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/auth'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Layout from './components/Layout'
import AITrainer from './pages/AITrainer'
import History from './pages/History'
import Profile from './pages/Profile'
import Opponents from './pages/Opponents'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (isAuthenticated) return <Navigate to="/app/trainer" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/app/trainer" replace />} />
            <Route path="trainer" element={<AITrainer />} />
            <Route path="history" element={<History />} />
            <Route path="opponents" element={<Opponents />} />
            <Route path="profile" element={<Profile />} />
            {/* Legacy redirects */}
            <Route path="dashboard" element={<Navigate to="/app/trainer" replace />} />
            <Route path="analyze" element={<Navigate to="/app/trainer" replace />} />
            <Route path="training" element={<Navigate to="/app/trainer" replace />} />
            <Route path="assistant" element={<Navigate to="/app/trainer" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
