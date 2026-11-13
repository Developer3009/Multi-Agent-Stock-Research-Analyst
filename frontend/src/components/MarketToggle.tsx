import React from 'react'
import clsx from 'clsx'
import type { Market } from '../types'

interface Props {
  market: Market
  onChange: (market: Market) => void
  size?: 'sm' | 'md'
}

export default function MarketToggle({ market, onChange, size = 'md' }: Props) {
  return (
    <div
      className={clsx(
        'flex items-center rounded-full border p-1 select-none',
        'border-gray-700 bg-gray-900',
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}
      title="Toggle between NSE, BSE, and US Markets"
    >
      <button
        type="button"
        onClick={() => onChange('NSE')}
        className={clsx(
          'px-3 py-1 rounded-full font-semibold transition-all duration-200',
          market === 'NSE'
            ? 'bg-green-700 text-white shadow'
            : 'text-gray-400 hover:text-gray-200'
        )}
      >
        NSE
      </button>
      <button
        type="button"
        onClick={() => onChange('BSE')}
        className={clsx(
          'px-3 py-1 rounded-full font-semibold transition-all duration-200',
          market === 'BSE'
            ? 'bg-red-700 text-white shadow'
            : 'text-gray-400 hover:text-gray-200'
        )}
      >
        BSE
      </button>
      <button
        type="button"
        onClick={() => onChange('US')}
        className={clsx(
          'px-3 py-1 rounded-full font-semibold transition-all duration-200 flex items-center gap-1',
          market === 'US'
            ? 'bg-blue-600 text-white shadow'
            : 'text-gray-400 hover:text-gray-200'
        )}
      >
        <span>🇺🇸</span> US
      </button>
    </div>
  )
}
