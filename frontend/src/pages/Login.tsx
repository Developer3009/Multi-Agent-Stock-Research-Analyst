import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Loader2, ShieldCheck, Zap } from 'lucide-react'
import InteractiveStockCanvas from '../components/InteractiveStockCanvas'

interface Props {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string, fullName?: string) => Promise<void>
}

export default function Login({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await onLogin(email, password)
      } else {
        await onRegister(email, password, fullName.trim() || undefined)
      }
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleFillDemo() {
    setEmail('trader@example.com')
    setPassword('Password123!')
  }

  return (
    <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-gray-950 text-gray-100">
      {/* ── LEFT SIDE: FULL-SCREEN FIXED STOCK GRAPH CANVAS ── */}
      <div className="flex-1 h-full relative overflow-hidden bg-gray-950">
        <InteractiveStockCanvas />
      </div>

      {/* ── RIGHT SIDE: FIXED LOGIN BOX DOCKED TO THE RIGHT ── */}
      <div className="w-full md:w-[420px] lg:w-[480px] h-full flex flex-col justify-between p-6 sm:p-8 bg-gray-900/95 border-l border-gray-800/80 z-20 overflow-y-auto shadow-2xl backdrop-blur-xl">
        {/* Top Header & Branding */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-md shadow-blue-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                StockResearch AI
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-700/50">
                  v2.0
                </span>
              </div>
              <div className="text-xs text-gray-400">Multi-Agent Intelligence · NSE, BSE & US Equities</div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {mode === 'login' ? 'Trader Login' : 'Create Trader Account'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Sign in to run real-time supervisor workflows, fundamental valuation, and stock news wires.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex border border-gray-800 bg-gray-950 p-1 rounded-xl mb-6">
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Full Name <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  type="text"
                  placeholder="Your Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address</label>
              <input
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                type="email"
                placeholder="trader@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleFillDemo}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Zap className="w-3 h-3" /> Quick Demo Fill
                  </button>
                )}
              </div>
              <input
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign In to Terminal' : 'Create Trader Account'}
            </button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-5 pt-4 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              256-Bit Encrypted Session
            </span>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Use Demo Login
            </button>
          </div>
        </div>

        {/* Bottom Section: Market Status & Footer */}
        <div className="mt-6 pt-4 border-t border-gray-800/80">
          <div className="flex items-center justify-between gap-1 text-[11px] text-gray-400 mb-3">
            <span className="px-2 py-0.5 rounded-md bg-gray-950 border border-gray-800">🟢 NSE</span>
            <span className="px-2 py-0.5 rounded-md bg-gray-950 border border-gray-800">🟢 BSE</span>
            <span className="px-2 py-0.5 rounded-md bg-gray-950 border border-gray-800">🟢 US (NASDAQ)</span>
            <span className="px-2 py-0.5 rounded-md bg-gray-950 border border-gray-800">⚡ Ollama</span>
          </div>

          <div className="text-center text-[11px] text-gray-600">
            StockResearch AI · LangGraph Supervisor Architecture
          </div>
        </div>
      </div>
    </div>
  )
}
