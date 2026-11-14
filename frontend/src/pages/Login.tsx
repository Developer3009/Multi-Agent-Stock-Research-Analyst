import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Loader2, ShieldCheck, Zap, ArrowLeftRight } from 'lucide-react'
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
  const [layoutPosition, setLayoutPosition] = useState<'login-left' | 'login-right'>('login-left')
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
    <div className="min-h-screen w-full bg-gray-950 text-gray-100 flex flex-col justify-between p-4 md:p-6 lg:p-8">
      {/* ── TOP NAV HEADER ── */}
      <header className="flex items-center justify-between py-2 px-2 border-b border-gray-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              StockResearch AI
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-700/50">
                Institutional v2.0
              </span>
            </div>
            <div className="text-xs text-gray-400">Multi-Agent Intelligence for NSE, BSE & US Equities</div>
          </div>
        </div>

        {/* Layout Swapper Pill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLayoutPosition((prev) => (prev === 'login-left' ? 'login-right' : 'login-left'))}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 font-medium transition-all"
            title="Swap columns between Login Box and Interactive Stock Canvas"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
            <span>Layout: {layoutPosition === 'login-left' ? 'Login Left' : 'Login Right'}</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER (SPLIT 2-COLUMN GRID) ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-7xl mx-auto w-full">
        {/* LOGIN BOX COLUMN */}
        <div
          className={`lg:col-span-5 w-full max-w-md mx-auto transition-all duration-300 ${
            layoutPosition === 'login-right' ? 'lg:order-2' : 'lg:order-1'
          }`}
        >
          <div className="bg-gray-900/90 border border-gray-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Top glowing ambient gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'login' ? 'Trader Authentication' : 'Create Trader Account'}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Access deep fundamental analysis, news wires, and real-time multi-agent consensus.
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
                    placeholder="Trader Name"
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
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'login' ? 'Sign In to Terminal' : 'Create Trader Account'}
              </button>
            </form>

            {/* Quick Demo Credentials Assistant */}
            <div className="mt-5 pt-4 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1">
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

          {/* Market Coverage Pills below Login */}
          <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-gray-400">
            <span className="px-2 py-0.5 rounded-md bg-gray-900 border border-gray-800">🟢 NSE Live</span>
            <span className="px-2 py-0.5 rounded-md bg-gray-900 border border-gray-800">🟢 BSE Live</span>
            <span className="px-2 py-0.5 rounded-md bg-gray-900 border border-gray-800">🟢 US Equities</span>
            <span className="px-2 py-0.5 rounded-md bg-gray-900 border border-gray-800">⚡ Ollama LLM</span>
          </div>
        </div>

        {/* INTERACTIVE MOUSE-RENDERED STOCK GRAPH COLUMN */}
        <div
          className={`lg:col-span-7 w-full h-[540px] transition-all duration-300 ${
            layoutPosition === 'login-right' ? 'lg:order-1' : 'lg:order-2'
          }`}
        >
          <InteractiveStockCanvas />
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="text-center text-xs text-gray-500 py-3 border-t border-gray-900 mt-6">
        StockResearch AI · Powered by LangGraph Multi-Agent Architecture, Ollama LLM & Real-Time Financial Wires
      </footer>
    </div>
  )
}
