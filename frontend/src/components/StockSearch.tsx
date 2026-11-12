import React, { useState, useRef, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { stocksAPI } from '../api/client'
import type { Market } from '../types'

interface SearchResult {
  ticker: string
  name: string
  market: Market
  yf_ticker: string
}

interface Props {
  market: Market
  onSelect: (ticker: string, name: string) => void
}

export default function StockSearch({ market, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<any>()

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timer.current)
    if (val.trim().length < 1) {
      setResults([])
      setOpen(false)
      return
    }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await stocksAPI.search(val, market)
        setResults(res.data.results || [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function handleSelect(r: SearchResult) {
    setQuery(r.name || r.ticker)
    setOpen(false)
    onSelect(r.ticker, r.name)
  }

  return (
    <div className="relative w-full" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
        <input
          className="input pl-10 pr-10"
          placeholder={`Search ${market} stocks — e.g. RELIANCE, TCS, Infosys...`}
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.yf_ticker}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors text-left"
              onClick={() => handleSelect(r)}
            >
              <div>
                <span className="font-semibold text-white">{r.ticker}</span>
                <span className="ml-2 text-sm text-gray-400">{r.name}</span>
              </div>
              <span className="text-xs text-gray-500">{r.yf_ticker}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
