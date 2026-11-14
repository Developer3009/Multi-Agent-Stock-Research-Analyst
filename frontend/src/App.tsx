import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Navbar from './components/Navbar'
import { Loader2 } from 'lucide-react'

export default function App() {
  const { user, loading, login, register, socialLogin, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      {user && <Navbar user={user} onLogout={logout} />}
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={login} onRegister={register} onSocialLogin={socialLogin} />
            )
          }
        />
        <Route
          path="/"
          element={user ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/history"
          element={user ? <History /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
