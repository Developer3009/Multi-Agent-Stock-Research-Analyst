import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Loader2, Star, StarOff, Play,
  RefreshCw, Newspaper, ExternalLink, Zap, Flame, ShieldAlert, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import clsx from 'clsx'
import MarketToggle from '../components/MarketToggle'
import StockSearch from '../components/StockSearch'
import StockChart from '../components/StockChart'
import AgentStatusCard from '../components/AgentStatusCard'
import ResearchReport from '../components/ResearchReport'
import { stocksAPI, researchAPI } from '../api/client'
import type { Market, OHLCVPoint, FullResearch, StockInfo, ResearchTask, StockMover } from '../types'
import { useMarket } from '../hooks/useMarket'

interface NewsItem {
  title: string
  url: string
  summary: string
  published_at?: string
  source: string
  sentiment?: 'positive' | 'negative' | 'neutral'
}

export default function Dashboard() {
  const { market, setMarket } = useMarket('NSE')
  const [selectedTicker, setSelectedTicker] = useState('')
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null)
  const [chartData, setChartData] = useState<OHLCVPoint[]>([])
  const [period, setPeriod] = useState('1y')
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [savedStocks, setSavedStocks] = useState<{ saved_stock_id: string; ticker: string; market: Market }[]>([])

  // Market Movers State (10 Bullish & 5 Bearish stocks across NSE/BSE/US)
  const [bullishStocks, setBullishStocks] = useState<StockMover[]>([])
  const [bearishStocks, setBearishStocks] = useState<StockMover[]>([])
  const [loadingMovers, setLoadingMovers] = useState(false)
  const [moversTab, setMoversTab] = useState<'all' | 'bullish' | 'bearish'>('all')

  // Live Auto-Refresh State (1-minute interval)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [liveNews, setLiveNews] = useState<NewsItem[]>([])

  // Research state
  const [researchTask, setResearchTask] = useState<ResearchTask | null>(null)
  const [fullResearch, setFullResearch] = useState<FullResearch | null>(null)
  const [researchLoading, setResearchLoading] = useState(false)
  const pollRef = useRef<any>()

  // Load saved stocks & market movers on mount
  useEffect(() => {
    stocksAPI.getSaved().then((res) => setSavedStocks(res.data)).catch(() => {})

    setLoadingMovers(true)
    stocksAPI.movers()
      .then((res) => {
        setBullishStocks(res.data?.bullish || [])
        setBearishStocks(res.data?.bearish || [])
      })
      .catch(() => {})
      .finally(() => setLoadingMovers(false))
  }, [])

  // Fetch initial stock info, chart, and live news when ticker/market/period changes
  useEffect(() => {
    if (!selectedTicker) return
    setLoadingInfo(true)
    setStockInfo(null)
    setChartData([])
    setLiveNews([])

    Promise.all([
      stocksAPI.info(selectedTicker, market),
      stocksAPI.history(selectedTicker, market, period),
      stocksAPI.news(selectedTicker, market).catch(() => ({ data: { articles: [] } })),
    ])
      .then(([infoRes, histRes, newsRes]) => {
        setStockInfo(infoRes.data)
        setChartData(histRes.data.data || [])
        setLiveNews(newsRes.data?.articles || [])
        setLastUpdated(new Date().toLocaleTimeString('en-IN'))
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false))
  }, [selectedTicker, market, period])

  // Function to refresh live data from internet
  const refreshLiveData = useCallback(async () => {
    if (!selectedTicker) return
    setRefreshing(true)
    try {
      const [liveRes, newsRes, histRes] = await Promise.all([
        stocksAPI.live(selectedTicker, market).catch(() => null),
        stocksAPI.news(selectedTicker, market).catch(() => null),
        period === '1d' ? stocksAPI.history(selectedTicker, market, '1d').catch(() => null) : Promise.resolve(null),
      ])

      if (liveRes?.data?.current_price) {
        setStockInfo((prev) => prev ? {
          ...prev,
          current_price: liveRes.data.current_price,
          '52w_high': liveRes.data.day_high || prev['52w_high'],
          '52w_low': liveRes.data.day_low || prev['52w_low'],
        } : prev)
      }

      if (newsRes?.data?.articles?.length) {
        setLiveNews(newsRes.data.articles)
      }

      if (histRes?.data?.data?.length) {
        setChartData(histRes.data.data)
      }

      setLastUpdated(new Date().toLocaleTimeString('en-IN'))
    } finally {
      setRefreshing(false)
    }
  }, [selectedTicker, market, period])

  // Periodic 60-second (1-minute) interval for live updates from internet
  useEffect(() => {
    if (!selectedTicker || !autoRefresh) return

    const interval = setInterval(() => {
      refreshLiveData()
    }, 60000)

    return () => clearInterval(interval)
  }, [selectedTicker, autoRefresh, refreshLiveData])

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

  function handleSelectMover(mover: StockMover) {
    setMarket(mover.market)
    setSelectedTicker(mover.ticker)
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

  const currencySymbol = market === 'US' || stockInfo?.currency === 'USD' ? '$' : '₹'

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
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500 font-semibold mr-1">Watchlist:</span>
          {savedStocks.map((s) => (
            <button
              key={s.saved_stock_id}
              onClick={() => { setMarket(s.market); handleSelect(s.ticker, s.ticker) }}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5',
                s.market === 'NSE' && 'border-green-800 text-green-400 hover:bg-green-900/30',
                s.market === 'BSE' && 'border-red-800 text-red-400 hover:bg-red-900/30',
                s.market === 'US' && 'border-blue-800 text-blue-400 hover:bg-blue-900/30'
              )}
            >
              <span className="font-semibold">{s.ticker}</span>
              <span className="text-[10px] opacity-75">· {s.market}</span>
            </button>
          ))}
        </div>
      )}

      {/* Stock Info Panel */}
      {selectedTicker ? (
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
                      'text-xs px-2.5 py-1 rounded-full font-semibold',
                      market === 'NSE' && 'bg-green-900/50 text-green-400 border border-green-800/50',
                      market === 'BSE' && 'bg-red-900/50 text-red-400 border border-red-800/50',
                      market === 'US' && 'bg-blue-900/50 text-blue-400 border border-blue-800/50'
                    )}>
                      {market === 'US' ? '🇺🇸 US' : market}
                    </span>
                    <button onClick={toggleSave} className="text-gray-500 hover:text-yellow-400 transition-colors">
                      {isSaved ? <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" /> : <StarOff className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => setSelectedTicker('')}
                      className="text-xs text-gray-400 hover:text-white underline ml-auto"
                    >
                      ← Back to Market Movers
                    </button>
                  </div>

                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-3xl font-bold">
                      {currencySymbol}{stockInfo.current_price !== undefined && stockInfo.current_price !== null ? stockInfo.current_price.toLocaleString('en-IN') : '—'}
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

                {/* Key Metrics & Live Badge */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-end gap-3 bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={clsx("w-2 h-2 rounded-full", autoRefresh ? "bg-green-400 animate-ping" : "bg-gray-600")} />
                      <span className="text-gray-400 font-medium">
                        {autoRefresh ? "Live 1m" : "Paused"}
                      </span>
                      {lastUpdated && (
                        <span className="text-gray-500 text-[11px]">· {lastUpdated}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      className={clsx(
                        "text-[10px] px-2 py-0.5 rounded font-medium border transition-colors",
                        autoRefresh ? "border-green-700 text-green-400" : "border-gray-700 text-gray-500"
                      )}
                    >
                      {autoRefresh ? "Auto On" : "Auto Off"}
                    </button>
                    <button
                      type="button"
                      onClick={refreshLiveData}
                      disabled={refreshing}
                      className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                      title="Refresh live data now"
                    >
                      <RefreshCw className={clsx("w-3.5 h-3.5", refreshing && "animate-spin")} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <Metric
                      label="Market Cap"
                      value={stockInfo.market_cap ? `${currencySymbol}${market === 'US' ? (stockInfo.market_cap / 1e9).toFixed(1) + 'B' : (stockInfo.market_cap / 1e7).toFixed(0) + 'Cr'}` : '—'}
                    />
                    <Metric label="P/E Ratio" value={stockInfo.pe_ratio?.toFixed(2) ?? '—'} />
                    <Metric label="P/B Ratio" value={stockInfo.pb_ratio?.toFixed(2) ?? '—'} />
                    <Metric label="52W High" value={stockInfo['52w_high'] ? `${currencySymbol}${stockInfo['52w_high'].toLocaleString('en-IN')}` : '—'} />
                    <Metric label="52W Low" value={stockInfo['52w_low'] ? `${currencySymbol}${stockInfo['52w_low'].toLocaleString('en-IN')}` : '—'} />
                    <Metric label="Beta" value={stockInfo.beta?.toFixed(2) ?? '—'} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Period Selector + Chart */}
          {chartData.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4">
                {['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={clsx(
                      'text-xs px-3 py-1 rounded-full transition-colors font-medium',
                      period === p
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    )}
                  >
                    {p === '1d' ? '1D (1m)' : p.toUpperCase()}
                  </button>
                ))}
              </div>
              <StockChart
                data={chartData}
                ticker={selectedTicker}
                market={market}
                height={380}
                sma={(() => {
                  const techResult = fullResearch?.agent_results?.find((r) => r.agent_name === 'technical')
                  const output = techResult?.output_json as Record<string, any> | undefined
                  const chartDataTech = output?.chart_data as Array<{ date: string; sma20?: number; sma50?: number }> | undefined
                  if (!chartDataTech) return undefined
                  return {
                    dates: chartData.map((d) => d.date),
                    sma20: chartData.map((d) => chartDataTech.find((c) => c.date === d.date)?.sma20 ?? null),
                    sma50: chartData.map((d) => chartDataTech.find((c) => c.date === d.date)?.sma50 ?? null),
                  }
                })()}
              />
            </div>
          )}

          {/* Live Breaking News Feed */}
          {liveNews.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold text-sm">Live Market News & Sentiment</h3>
                </div>
                <span className="text-xs text-gray-500">Live RSS Feeds · Updated by minute</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveNews.slice(0, 4).map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-gray-800/40 hover:bg-gray-800 rounded-lg border border-gray-700/50 transition-colors flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                        <span className="font-medium text-gray-300">{item.source}</span>
                        <span className={clsx(
                          "text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase",
                          item.sentiment === 'positive' && "bg-green-900/60 text-green-300 border border-green-700/50",
                          item.sentiment === 'negative' && "bg-red-900/60 text-red-300 border border-red-700/50",
                          item.sentiment === 'neutral' && "bg-gray-700/60 text-gray-300 border border-gray-600/50"
                        )}>
                          {item.sentiment || 'neutral'}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-gray-200 group-hover:text-blue-400 transition-colors line-clamp-2">
                        {item.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/30 text-[10px] text-gray-500">
                      <span>{item.published_at ? new Date(item.published_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Recent'}</span>
                      <span className="flex items-center gap-1 text-blue-400 group-hover:underline">
                        Read source <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
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
      ) : (
        /* ── Landing Page (After Login): 10 Bullish & 5 Bearish Stocks (Indian & US) ── */
        <div className="space-y-6">
          {/* Welcome & Pulse Header */}
          <div className="card bg-gradient-to-r from-gray-900 via-gray-900/90 to-blue-950/40 border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-bold text-white">Daily Market Pulse & Screener</h2>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Real-time technical momentum across <span className="text-green-400 font-semibold">NSE</span>, <span className="text-red-400 font-semibold">BSE</span>, and <span className="text-blue-400 font-semibold">🇺🇸 US Markets</span>. Click any stock to view live 1m charts & run AI research.
              </p>
            </div>

            {/* Movers Filter Tabs */}
            <div className="flex items-center bg-gray-800/80 p-1 rounded-lg border border-gray-700/60 self-start sm:self-center">
              <button
                onClick={() => setMoversTab('all')}
                className={clsx(
                  'text-xs px-3 py-1 rounded font-medium transition-all',
                  moversTab === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                )}
              >
                All Movers
              </button>
              <button
                onClick={() => setMoversTab('bullish')}
                className={clsx(
                  'text-xs px-3 py-1 rounded font-medium transition-all flex items-center gap-1',
                  moversTab === 'bullish' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                )}
              >
                <Flame className="w-3.5 h-3.5" /> 10 Bullish
              </button>
              <button
                onClick={() => setMoversTab('bearish')}
                className={clsx(
                  'text-xs px-3 py-1 rounded font-medium transition-all flex items-center gap-1',
                  moversTab === 'bearish' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                )}
              >
                <ShieldAlert className="w-3.5 h-3.5" /> 5 Bearish
              </button>
            </div>
          </div>

          {loadingMovers ? (
            <div className="card flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* 10 Bullish Stocks Section */}
              {(moversTab === 'all' || moversTab === 'bullish') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-green-900/40 border border-green-700/50 flex items-center justify-center text-green-400">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-green-400 uppercase tracking-wide flex items-center gap-2">
                          10 Bullish Stocks <span className="text-[11px] font-normal text-gray-400">(Top Positive Momentum)</span>
                        </h3>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Indian & US Markets</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {bullishStocks.map((stock) => (
                      <div
                        key={`${stock.market}-${stock.ticker}`}
                        onClick={() => handleSelectMover(stock)}
                        className="card p-3.5 cursor-pointer hover:border-green-600/80 hover:bg-gray-800/60 transition-all border-green-900/30 flex flex-col justify-between group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-bl-full pointer-events-none" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-base text-white group-hover:text-green-400 transition-colors">
                              {stock.ticker}
                            </span>
                            <span className={clsx(
                              'text-[10px] px-2 py-0.5 rounded font-semibold',
                              stock.market === 'NSE' && 'bg-green-900/60 text-green-300 border border-green-800',
                              stock.market === 'BSE' && 'bg-red-900/60 text-red-300 border border-red-800',
                              stock.market === 'US' && 'bg-blue-900/60 text-blue-300 border border-blue-800'
                            )}>
                              {stock.market === 'US' ? '🇺🇸 US' : stock.market}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{stock.name}</p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-baseline justify-between">
                          <div>
                            <span className="text-xs text-gray-500 block text-[10px]">Price</span>
                            <span className="font-bold text-sm text-gray-200">
                              {stock.currency === 'USD' ? '$' : '₹'}{stock.current_price?.toLocaleString('en-IN') ?? '—'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-green-400 font-bold flex items-center justify-end">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              +{stock.change_pct !== undefined ? stock.change_pct.toFixed(2) : '0.00'}%
                            </span>
                            <span className="text-[9px] text-gray-500 truncate block max-w-[95px] mt-0.5">
                              {stock.signal || 'Strong Uptrend'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5 Bearish Stocks Section */}
              {(moversTab === 'all' || moversTab === 'bearish') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-red-900/40 border border-red-700/50 flex items-center justify-center text-red-400">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-red-400 uppercase tracking-wide flex items-center gap-2">
                          5 Bearish Stocks <span className="text-[11px] font-normal text-gray-400">(Downside & Selling Pressure)</span>
                        </h3>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Indian & US Markets</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {bearishStocks.map((stock) => (
                      <div
                        key={`${stock.market}-${stock.ticker}`}
                        onClick={() => handleSelectMover(stock)}
                        className="card p-3.5 cursor-pointer hover:border-red-600/80 hover:bg-gray-800/60 transition-all border-red-900/30 flex flex-col justify-between group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full pointer-events-none" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-base text-white group-hover:text-red-400 transition-colors">
                              {stock.ticker}
                            </span>
                            <span className={clsx(
                              'text-[10px] px-2 py-0.5 rounded font-semibold',
                              stock.market === 'NSE' && 'bg-green-900/60 text-green-300 border border-green-800',
                              stock.market === 'BSE' && 'bg-red-900/60 text-red-300 border border-red-800',
                              stock.market === 'US' && 'bg-blue-900/60 text-blue-300 border border-blue-800'
                            )}>
                              {stock.market === 'US' ? '🇺🇸 US' : stock.market}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{stock.name}</p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-baseline justify-between">
                          <div>
                            <span className="text-xs text-gray-500 block text-[10px]">Price</span>
                            <span className="font-bold text-sm text-gray-200">
                              {stock.currency === 'USD' ? '$' : '₹'}{stock.current_price?.toLocaleString('en-IN') ?? '—'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-red-400 font-bold flex items-center justify-end">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              {stock.change_pct !== undefined ? stock.change_pct.toFixed(2) : '-0.00'}%
                            </span>
                            <span className="text-[9px] text-gray-500 truncate block max-w-[95px] mt-0.5">
                              {stock.signal || 'Downside Correction'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
