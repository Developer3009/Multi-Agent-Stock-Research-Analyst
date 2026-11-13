import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, LogOut, BookOpen, ShieldCheck, Zap } from 'lucide-react'
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
    <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-md border-b border-gray-800/80">
      {/* Top Global Market Ticker Bar */}
      <div className="bg-gray-900/80 border-b border-gray-800/60 px-4 py-1 text-[11px] text-gray-400 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 font-semibold text-gray-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 uppercase tracking-wider text-[10px]">Markets Live</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-300 font-medium">NIFTY 50</span>
            <span className="text-gray-200">24,148.25</span>
            <span className="text-emerald-400 font-semibold">+0.42%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-300 font-medium">SENSEX</span>
            <span className="text-gray-200">79,486.30</span>
            <span className="text-emerald-400 font-semibold">+0.38%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-300 font-medium">NASDAQ</span>
            <span className="text-gray-200">18,987.40</span>
            <span className="text-emerald-400 font-semibold">+0.82%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-300 font-medium">S&P 500</span>
            <span className="text-gray-200">5,864.67</span>
            <span className="text-emerald-400 font-semibold">+0.56%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-300 font-medium">VIX (Volatility)</span>
            <span className="text-gray-200">14.20</span>
            <span className="text-emerald-400 font-semibold">-3.12%</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1 text-emerald-400/90 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Institutional Verification
          </span>
          <span className="flex items-center gap-1 text-blue-400/90 font-medium bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40">
            <Zap className="w-3 h-3 text-yellow-400" /> Alpha Vantage API Active
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-lg text-white group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="leading-tight tracking-tight">StockResearch <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">AI</span></span>
            <span className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">Institutional Trading Terminal</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <Link
                to="/history"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-colors shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>Audit History</span>
              </Link>
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs text-gray-300 font-medium">{user.email}</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Verified Trader
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1.5"
                title="Sign out of trading terminal"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
