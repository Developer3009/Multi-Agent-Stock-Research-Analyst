import React from 'react'
import clsx from 'clsx'
import type { Market } from '../types'

interface Props {
  market: Market
  onChange: (market: Market) => void
  size?: 'sm' | 'md'
}

export default function MarketToggle({ market, onChange, size = 'md' }: Props) {
  const isNSE = market === 'NSE'

  return (
    <div
      className={clsx(
        'flex items-center rounded-full border p-1 select-none',
        'border-gray-700 bg-gray-900',
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}
      title="Toggle between NSE and BSE"
    >
      <button
        onClick={() => onChange('NSE')}
        className={clsx(
          'px-3 py-1 rounded-full font-semibold transition-all duration-200',
          isNSE
            ? 'bg-green-700 text-white shadow'
            : 'text-gray-400 hover:text-gray-200'
        )}
      >
        NSE
      </button>
      <button
        onClick={() => onChange('BSE')}
        className={clsx(
          'px-3 py-1 rounded-full font-semibold transition-all duration-200',
          !isNSE
            ? 'bg-red-700 text-white shadow'
            : 'text-gray-400 hover:text-gray-200'
        )}
      >
        BSE
      </button>
    </div>
  )
}
