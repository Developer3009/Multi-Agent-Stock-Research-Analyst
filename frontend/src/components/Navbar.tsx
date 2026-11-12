import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, LogOut, BookOpen } from 'lucide-react'
import type { User } from '../types'

interface Props {
  user: User | null
  onLogout: () => void
}

export default function Navbar({ user, onLogout }: Props) {
  const navigate = useNavigate()

  function handleLogout() {
    onLogout()
    navigate('/login')
  }

  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-white">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <span>StockResearch <span className="text-blue-400">AI</span></span>
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <Link to="/history" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                <BookOpen className="w-4 h-4" />
                History
              </Link>
              <span className="text-xs text-gray-600 hidden sm:block">{user.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
