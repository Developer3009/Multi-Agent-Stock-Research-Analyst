import { useState, useCallback } from 'react'
import type { Market } from '../types'

export function useMarket(defaultMarket: Market = 'NSE') {
  const [market, setMarket] = useState<Market>(defaultMarket)

  const toggleMarket = useCallback(() => {
    setMarket((prev) => (prev === 'NSE' ? 'BSE' : 'NSE'))
  }, [])

  return { market, setMarket, toggleMarket }
}
