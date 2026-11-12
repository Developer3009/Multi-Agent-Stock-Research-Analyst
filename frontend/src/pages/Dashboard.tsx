import React, { useState, useEffect, useRef } from 'react'
import {
  TrendingUp, TrendingDown, Loader2, Star, StarOff, Play
} from 'lucide-react'
import clsx from 'clsx'
import MarketToggle from '../components/MarketToggle'
import StockSearch from '../components/StockSearch'
import StockChart from '../components/StockChart'
import AgentStatusCard from '../components/AgentStatusCard'
import ResearchReport from '../components/ResearchReport'
import { stocksAPI, researchAPI } from '../api/client'
import type { Market, OHLCVPoint, FullResearch, StockInfo, ResearchTask } from '../types'
import { useMarket } from '../hooks/useMarket'

export default function Dashboard() {
  const { market, setMarket } = useMarket('NSE')
  const [selectedTicker, setSelectedTicker] = useState('')
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null)
  const [chartData, setChartData] = useState<OHLCVPoint[]>([])
  const [period, setPeriod] = useState('1y')
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [savedStocks, setSavedStocks] = useState<{ saved_stock_id: string; ticker: string; market: Market }[]>([])

  // Research state
  const [researchTask, setResearchTask] = useState<ResearchTask | null>(null)
  const [fullResearch, setFullResearch] = useState<FullResearch | null>(null)
  const [researchLoading, setResearchLoading] = useState(false)
  const pollRef = useRef<any>()

  // Load saved stocks on mount
  useEffect(() => {
    stocksAPI.getSaved().then((res) => setSavedStocks(res.data)).catch(() => {})
  }, [])

  // Load stock info and chart when ticker/market/period changes
  useEffect(() => {
    if (!selectedTicker) return
    setLoadingInfo(true)
    setStockInfo(null)
    setChartData([])
    Promise.all([
      stocksAPI.info(selectedTicker, market),
      stocksAPI.history(selectedTicker, market, period),
    ])
      .then(([infoRes, histRes]) => {
        setStockInfo(infoRes.data)
        setChartData(histRes.data.data || [])
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false))
  }, [selectedTicker, market, period])

  // Poll research task status
  useEffect(() => {
    if (!researchTask) return
    if (researchTask.status === 'completed' || researchTask.status === 'failed') return

    pollRef.current = setInterval(async () => {
      try {
        const statusRes = await researchAPI.status(researchTask.task_id)
        const updated = statusRes.data as ResearchTask
        setResearchTask(updated)
        if (updated.status === 'completed' || updated.status === 'failed') {
          clearInterval(pollRef.current)
          if (updated.status === 'completed') {
            const fullRes = await researchAPI.result(researchTask.task_id)
            setFullResearch(fullRes.data)
          }
          setResearchLoading(false)
        }
      } catch {
        clearInterval(pollRef.current)
        setResearchLoading(false)
      }
    }, 3000)

    return () => clearInterval(pollRef.current)
  }, [researchTask])

  function handleSelect(ticker: string, _name: string) {
    setSelectedTicker(ticker)
    setResearchTask(null)
    setFullResearch(null)
  }

  async function handleStartResearch() {
    if (!selectedTicker) return
    setResearchLoading(true)
    setFullResearch(null)
    try {
      const res = await researchAPI.start(selectedTicker, market, period)
      setResearchTask(res.data)
    } catch {
      setResearchLoading(false)
    }
  }

  const isSaved = savedStocks.some(
    (s) => s.ticker === selectedTicker && s.market === market
  )

  async function toggleSave() {
    if (!selectedTicker) return
    if (isSaved) {
      const saved = savedStocks.find((s) => s.ticker === selectedTicker && s.market === market)
      if (saved) {
        await stocksAPI.deleteSaved(saved.saved_stock_id)
        setSavedStocks((prev) => prev.filter((s) => s.saved_stock_id !== saved.saved_stock_id))
      }
    } else {
      const res = await stocksAPI.saveStock(selectedTicker, market)
      setSavedStocks((prev) => [...prev, res.data])
    }
  }

  const priceChange = stockInfo?.current_price && chartData.length > 1
    ? stockInfo.current_price - chartData[0].close
    : null
  const priceChangePct = priceChange && chartData[0]?.close
    ? (priceChange / chartData[0].close) * 100
    : null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header: Search + Market Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <StockSearch market={market} onSelect={handleSelect} />
        </div>
        <MarketToggle market={market} onChange={setMarket} />
      </div>

      {/* Watchlist */}
      {savedStocks.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {savedStocks.map((s) => (
            <button
              key={s.saved_stock_id}
              onClick={() => { setMarket(s.market); handleSelect(s.ticker, s.ticker) }}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-full border transition-all',
                s.market === 'NSE'
                  ? 'border-green-800 text-green-400 hover:bg-green-900/30'
                  : 'border-red-800 text-red-400 hover:bg-red-900/30'
              )}
            >
              {s.ticker} · {s.market}
            </button>
          ))}
        </div>
      )}

      {/* Stock Info Panel */}
      {selectedTicker && (
        <>
          {loadingInfo ? (
            <div className="card flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : stockInfo ? (
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{selectedTicker}</h2>
                      <p className="text-sm text-gray-400">{stockInfo.name}</p>
                    </div>
                    <span className={clsx(
                      'text-xs px-2 py-1 rounded-full font-semibold',
                      market === 'NSE' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                    )}>{market}</span>
                    <button onClick={toggleSave} className="text-gray-500 hover:text-yellow-400 transition-colors">
                      {isSaved ? <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" /> : <StarOff className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-3xl font-bold">
                      ₹{stockInfo.current_price?.toLocaleString('en-IN') ?? '—'}
                    </span>
                    {priceChangePct !== null && (
                      <span className={clsx(
                        'flex items-center gap-1 text-sm font-semibold',
                        priceChangePct >= 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {priceChangePct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    {stockInfo.sector && <span>{stockInfo.sector} · </span>}
                    {stockInfo.industry && <span>{stockInfo.industry}</span>}
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <Metric label="Market Cap" value={stockInfo.market_cap ? `₹${(stockInfo.market_cap / 1e7).toFixed(0)}Cr` : '—'} />
                  <Metric label="P/E Ratio" value={stockInfo.pe_ratio?.toFixed(2) ?? '—'} />
                  <Metric label="P/B Ratio" value={stockInfo.pb_ratio?.toFixed(2) ?? '—'} />
                  <Metric label="52W High" value={stockInfo['52w_high'] ? `₹${stockInfo['52w_high'].toLocaleString('en-IN')}` : '—'} />
                  <Metric label="52W Low" value={stockInfo['52w_low'] ? `₹${stockInfo['52w_low'].toLocaleString('en-IN')}` : '—'} />
                  <Metric label="Beta" value={stockInfo.beta?.toFixed(2) ?? '—'} />
                </div>
              </div>
            </div>
          ) : null}

          {/* Period Selector + Chart */}
          {chartData.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4">
                {['1mo', '3mo', '6mo', '1y', '2y', '5y'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={clsx(
                      'text-xs px-3 py-1 rounded-full transition-colors',
                      period === p
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <StockChart data={chartData} ticker={selectedTicker} market={market} height={380} />
            </div>
          )}

          {/* Start Research CTA */}
          <div className="card flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold">AI Research Analysis</h3>
              <p className="text-sm text-gray-400 mt-0.5">
                Run all 4 specialist agents + Supervisor for <span className="text-white font-semibold">{selectedTicker}</span> ({market})
              </p>
            </div>
            <button
              onClick={handleStartResearch}
              disabled={researchLoading || researchTask?.status === 'running'}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {researchLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Play className="w-4 h-4" /> Start Research</>
              )}
            </button>
          </div>

          {/* Agent Progress */}
          {researchTask && (
            <div>
              <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-wide">Agent Progress</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {['fundamental', 'technical', 'news', 'risk'].map((agent) => {
                  const result = fullResearch?.agent_results?.find((r) => r.agent_name === agent)
                  return (
                    <AgentStatusCard
                      key={agent}
                      agentName={agent}
                      result={result}
                      running={researchTask.status === 'running'}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Final Report */}
          {fullResearch?.report && (
            <ResearchReport report={fullResearch.report} />
          )}
        </>
      )}

      {/* Empty state */}
      {!selectedTicker && (
        <div className="card text-center py-16">
          <TrendingUp className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400">Search for a Stock to Begin</h3>
          <p className="text-sm text-gray-600 mt-2">
            Enter a company name or ticker symbol above.<br />
            Toggle between NSE and BSE markets.
          </p>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-sm mt-0.5">{value}</p>
    </div>
  )
}
