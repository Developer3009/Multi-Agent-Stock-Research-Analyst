import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, BookOpen, ShieldCheck, Zap, Sun, Moon } from 'lucide-react'
import type { User } from '../types'
import UpwardLogo from './UpwardLogo'
import { useTheme } from '../context/ThemeContext'

interface Props {
  user: User | null
  onLogout: () => void
}

export default function Navbar({ user, onLogout }: Props) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  function handleLogout() {
    onLogout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#090d14]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 transition-colors">
      {/* Top Global Market Ticker Bar */}
      <div className="bg-slate-50 dark:bg-[#0d121f]/90 border-b border-slate-200 dark:border-slate-800/60 px-4 py-1 text-[11px] text-slate-600 dark:text-gray-400 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center justify-between gap-6 transition-colors">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-gray-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[10px] font-bold">
              Markets Live
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700 dark:text-gray-300">NIFTY 50</span>
            <span className="font-semibold text-slate-900 dark:text-gray-100">24,148.25</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+0.42%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700 dark:text-gray-300">SENSEX</span>
            <span className="font-semibold text-slate-900 dark:text-gray-100">79,486.30</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+0.38%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700 dark:text-gray-300">NASDAQ</span>
            <span className="font-semibold text-slate-900 dark:text-gray-100">18,987.40</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+0.82%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700 dark:text-gray-300">S&P 500</span>
            <span className="font-semibold text-slate-900 dark:text-gray-100">5,864.67</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+0.56%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700 dark:text-gray-300">VIX</span>
            <span className="font-semibold text-slate-900 dark:text-gray-100">14.20</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">-3.12%</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
            <ShieldCheck className="w-3 h-3 text-emerald-500" /> Upward Institutional Execution
          </span>
          <span className="flex items-center gap-1 text-slate-700 dark:text-blue-400 font-medium bg-slate-100 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-slate-200 dark:border-blue-800/40">
            <Zap className="w-3 h-3 text-amber-500" /> Live Feed Synced
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 h-15 py-2 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group focus:outline-none">
          <UpwardLogo size="md" variant="full" />
        </Link>

        <div className="flex items-center gap-3">
          {/* Global Light / Dark Mode Toggle Pill */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                <span>Dark</span>
              </>
            )}
          </button>

          {user && (
            <>
              <Link
                to="/history"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors shadow-sm bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Audit History</span>
              </Link>

              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user.email}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Upward Trader
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors px-2 py-1.5"
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
