import React from 'react'
import { useTheme } from '../context/ThemeContext'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
  className?: string
}

export default function UpwardLogo({ size = 'md', variant = 'full', className = '' }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const imgSizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
  const titleSizeClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'
  const subtitleSizeClass = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-[11px]' : 'text-[9px]'

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* High-definition Logo Image */}
      <div
        className={`relative ${imgSizeClass} rounded-xl overflow-hidden shadow-md flex items-center justify-center p-0.5 border ${
          isDark
            ? 'bg-white border-emerald-500/30 shadow-emerald-950/40'
            : 'bg-white border-slate-200 shadow-slate-200/80'
        }`}
      >
        <img
          src="/upward-logo.jpg"
          alt="Upward Financial Logo"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Brand Typography */}
      {variant === 'full' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight leading-none ${titleSizeClass} ${
                isDark ? 'text-white' : 'text-[#0f172a]'
              }`}
            >
              UPWARD
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              PRO
            </span>
          </div>
          <span
            className={`font-bold tracking-[0.22em] uppercase leading-none mt-1 ${subtitleSizeClass} ${
              isDark ? 'text-emerald-400' : 'text-emerald-600'
            }`}
          >
            FINANCIAL
          </span>
        </div>
      )}
    </div>
  )
}
