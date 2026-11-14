import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Check, Zap, Sun, Moon } from 'lucide-react'
import InteractiveStockCanvas from '../components/InteractiveStockCanvas'
import UpwardLogo from '../components/UpwardLogo'
import { useTheme } from '../context/ThemeContext'

interface Props {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string, fullName?: string, phone?: string) => Promise<void>
  onSocialLogin?: (provider: string, email?: string, fullName?: string) => Promise<void>
}

interface CountryOption {
  code: string
  dial: string
  flag: string
  name: string
}

const COUNTRIES: CountryOption[] = [
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: 'SG', dial: '+65', flag: '🇸🇬', name: 'Singapore' },
]

export default function Login({ onLogin, onRegister, onSocialLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0])
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('English (India)')
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await onLogin(email, password)
      } else {
        const fullPhone = phone.trim() ? `${selectedCountry.dial} ${phone.trim()}` : undefined
        await onRegister(email, password, fullName.trim() || undefined, fullPhone)
      }
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Authentication failed. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSocial(provider: string) {
    setError('')
    setLoading(true)
    try {
      if (onSocialLogin) {
        await onSocialLogin(provider)
      } else {
        await onLogin('trader@example.com', 'Password123!')
      }
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || `Failed to sign in with ${provider}.`)
    } finally {
      setLoading(false)
    }
  }

  function handleFillDemo() {
    setEmail('trader@example.com')
    setPassword('Password123!')
    setFullName('Pro Trader')
    setPhone('9876543210')
  }

  return (
    <div
      className={`h-screen w-full flex flex-col md:flex-row overflow-hidden transition-colors duration-200 font-sans ${
        isDark ? 'bg-[#090d14] text-gray-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* ── LEFT SIDE: FULL-SCREEN FIXED STOCK GRAPH CANVAS ── */}
      <div className="hidden md:flex flex-1 h-full relative overflow-hidden bg-[#07090e]">
        <InteractiveStockCanvas />
      </div>

      {/* ── RIGHT SIDE: DOCKED AUTHENTICATION BOX (MATCHING SCREENSHOT & LOGO THEME) ── */}
      <div
        className={`w-full md:w-[460px] lg:w-[490px] h-full flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 border-l transition-colors z-20 overflow-y-auto ${
          isDark
            ? 'bg-[#0c0f17] border-[#1a202c]'
            : 'bg-white border-slate-200 shadow-2xl'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between mb-4">
            <UpwardLogo size="md" variant="full" />
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isDark
                  ? 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>

          {/* Top Header: Language Selector on Left, Login/Register pills on Right */}
          <div className="flex items-center justify-between pb-4 mb-2 border-b border-slate-200 dark:border-slate-800/80">
            {/* Language dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLanguageMenuOpen((prev) => !prev)}
                className={`flex items-center gap-2 text-xs sm:text-sm transition-colors py-1 focus:outline-none ${
                  isDark ? 'text-gray-200 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span className="text-base">🇮🇳</span>
                <span className="font-semibold">{selectedLanguage}</span>
              </button>

              {languageMenuOpen && (
                <div
                  className={`absolute top-full left-0 mt-1.5 w-44 rounded-xl shadow-2xl py-1 z-30 border ${
                    isDark
                      ? 'bg-[#141824] border-[#232a3b]'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLanguage('English (India)')
                      setLanguageMenuOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                      isDark ? 'text-gray-300 hover:bg-[#1e2538] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🇮🇳</span> English (India)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLanguage('English (US)')
                      setLanguageMenuOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                      isDark ? 'text-gray-300 hover:bg-[#1e2538] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🇺🇸</span> English (US)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLanguage('English (UK)')
                      setLanguageMenuOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                      isDark ? 'text-gray-300 hover:bg-[#1e2538] hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🇬🇧</span> English (UK)
                  </button>
                </div>
              )}
            </div>

            {/* Login / Register Toggle Pills */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  mode === 'login'
                    ? isDark
                      ? 'border border-gray-400 bg-black/80 text-white shadow-sm'
                      : 'border border-slate-800 bg-slate-900 text-white shadow-sm'
                    : isDark
                    ? 'border border-gray-700/80 bg-[#121622] text-gray-400 hover:text-white'
                    : 'border border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  mode === 'register'
                    ? isDark
                      ? 'border border-gray-400 bg-black/80 text-white shadow-sm'
                      : 'border border-slate-800 bg-slate-900 text-white shadow-sm'
                    : isDark
                    ? 'border border-gray-700/80 bg-[#121622] text-gray-400 hover:text-white'
                    : 'border border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
            {mode === 'register' && (
              <div>
                <label
                  className={`block text-xs sm:text-sm font-medium mb-1.5 ${
                    isDark ? 'text-gray-300' : 'text-slate-700'
                  }`}
                >
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder=""
                  className={`w-full rounded-lg px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 border ${
                    isDark
                      ? 'bg-[#121622] border-[#232a3b] text-white placeholder-gray-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
              </div>
            )}

            <div>
              <label
                className={`block text-xs sm:text-sm font-medium mb-1.5 ${
                  isDark ? 'text-gray-300' : 'text-slate-700'
                }`}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                className={`w-full rounded-lg px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 border ${
                  isDark
                    ? 'bg-[#121622] border-[#232a3b] text-white placeholder-gray-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className={`block text-xs sm:text-sm font-medium ${
                    isDark ? 'text-gray-300' : 'text-slate-700'
                  }`}
                >
                  {mode === 'register' ? 'Create a password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleFillDemo}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold transition-colors"
                  >
                    <Zap className="w-3 h-3 text-amber-500" /> Demo Trader Fill
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  minLength={6}
                  className={`w-full rounded-lg pl-3.5 pr-10 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 border ${
                    isDark
                      ? 'bg-[#121622] border-[#232a3b] text-white placeholder-gray-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 dark:hover:text-gray-200 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label
                  className={`block text-xs sm:text-sm font-medium mb-1.5 ${
                    isDark ? 'text-gray-300' : 'text-slate-700'
                  }`}
                >
                  Phone
                </label>
                <div
                  className={`flex rounded-lg overflow-hidden border transition-all focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 ${
                    isDark
                      ? 'border-[#232a3b] bg-[#121622]'
                      : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  {/* Country Flag & Dial Selector */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-2.5 border-r text-xs sm:text-sm cursor-pointer select-none ${
                      isDark
                        ? 'bg-[#161b2a] border-[#232a3b] text-gray-200'
                        : 'bg-slate-100 border-slate-300 text-slate-800'
                    }`}
                  >
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span className="font-semibold">{selectedCountry.dial}</span>
                    <select
                      value={selectedCountry.code}
                      onChange={(e) => {
                        const found = COUNTRIES.find((c) => c.code === e.target.value)
                        if (found) setSelectedCountry(found)
                      }}
                      className="opacity-0 absolute w-16 h-8 cursor-pointer"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-gray-900 text-white">
                          {c.flag} {c.dial} {c.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-gray-400 text-[10px]">▼</span>
                  </div>

                  {/* Phone input */}
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder=""
                    className={`flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none ${
                      isDark ? 'text-white placeholder-gray-600' : 'text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-rose-500 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Primary Action Button (Upward Financial Arrow Green) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'register' ? 'Start Now' : 'Sign In'}
            </button>
          </form>

          {/* Privacy Disclaimer */}
          <div
            className={`mt-3.5 text-xs leading-relaxed ${
              isDark ? 'text-gray-400' : 'text-slate-500'
            }`}
          >
            By submitting your information, you agree to our{' '}
            <a href="#privacy" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Privacy Policy
            </a>
          </div>

          {/* Electronic Communications Checkbox */}
          <div className="mt-3 flex items-start gap-2.5">
            <button
              type="button"
              onClick={() => setAgreeTerms((prev) => !prev)}
              className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center transition-colors ${
                agreeTerms
                  ? 'bg-[#059669] text-white'
                  : isDark
                  ? 'border border-gray-600 bg-transparent'
                  : 'border border-slate-300 bg-transparent'
              }`}
            >
              {agreeTerms && <Check className="w-3 h-3 stroke-[3]" />}
            </button>
            <label
              onClick={() => setAgreeTerms((prev) => !prev)}
              className={`text-xs cursor-pointer select-none leading-snug ${
                isDark ? 'text-gray-300' : 'text-slate-700'
              }`}
            >
              I agree to receive electronic communications from Upward Financial
            </label>
          </div>

          {/* Divider */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div
                className={`w-full border-t ${
                  isDark ? 'border-[#1c2333]' : 'border-slate-200'
                }`}
              />
            </div>
            <span
              className={`relative px-3 text-xs ${
                isDark ? 'bg-[#0c0f17] text-gray-400' : 'bg-white text-slate-500'
              }`}
            >
              {mode === 'register' ? 'Or register with' : 'Or login with'}
            </span>
          </div>

          {/* Social Auth Buttons (Google, Facebook, Apple) */}
          <div className="flex items-center justify-center gap-4">
            {/* Google */}
            <button
              type="button"
              onClick={() => handleSocial('google')}
              className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-sm transition-all group ${
                isDark
                  ? 'bg-[#141926] border-[#232a3b] hover:border-gray-500 hover:bg-[#1c2336]'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-400 hover:bg-slate-100'
              }`}
              title="Sign in with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </button>

            {/* Facebook */}
            <button
              type="button"
              onClick={() => handleSocial('facebook')}
              className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-sm transition-all group ${
                isDark
                  ? 'bg-[#141926] border-[#232a3b] hover:border-gray-500 hover:bg-[#1c2336]'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-400 hover:bg-slate-100'
              }`}
              title="Sign in with Facebook"
            >
              <svg className="w-5 h-5 fill-[#1877F2]" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </button>

            {/* Apple */}
            <button
              type="button"
              onClick={() => handleSocial('apple')}
              className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-sm transition-all group ${
                isDark
                  ? 'bg-[#141926] border-[#232a3b] hover:border-gray-500 hover:bg-[#1c2336]'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-400 hover:bg-slate-100'
              }`}
              title="Sign in with Apple"
            >
              <svg
                className={`w-5 h-5 ${isDark ? 'fill-white' : 'fill-slate-900'}`}
                viewBox="0 0 24 24"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.13.65-2.79 1.41-.58.66-1.09 1.73-.97 2.76 1.07.08 2.13-.55 2.75-1.3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div
          className={`pt-4 text-center text-[11px] border-t mt-4 ${
            isDark ? 'text-gray-500 border-[#1a202c]' : 'text-slate-400 border-slate-200'
          }`}
        >
          Upward Financial · Institutional Multi-Agent Intelligence
        </div>
      </div>
    </div>
  )
}
