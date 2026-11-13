import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Loader2, Star, StarOff, Play,
  RefreshCw, Newspaper, ExternalLink, Zap, Flame, ShieldAlert,
  ArrowUpRight, ArrowDownRight, ShieldCheck, CheckCircle2,
  BarChart3, Activity, Lock, Layers
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

  // Market Movers State (5 Bullish & 5 Bearish stocks across NSE/BSE/US)
  const [bullishStocks, setBullishStocks] = useState<StockMover[]>([])
  const [bearishStocks, setBearishStocks] = useState<StockMover[]>([])
  const [loadingMovers, setLoadingMovers] = useState(false)
  const [moversMarketFilter, setMoversMarketFilter] = useState<'ALL' | 'IN' | 'US'>('ALL')

  // Live Auto-Refresh State (1-minute interval)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [liveNews, setLiveNews] = useState<NewsItem[]>([])
  const [liveSource, setLiveSource] = useState<string>('Alpha Vantage API')

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
        setBullishStocks((res.data?.bullish || []).slice(0, 5))
        setBearishStocks((res.data?.bearish || []).slice(0, 5))
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
        if (liveRes.data.source || liveRes.data.api_source) {
          setLiveSource(liveRes.data.api_source || liveRes.data.source)
        }
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

  // Filtered Movers
  const filterMover = (m: StockMover) => {
    if (moversMarketFilter === 'US') return m.market === 'US'
    if (moversMarketFilter === 'IN') return m.market === 'NSE' || m.market === 'BSE'
    return true
  }

  const displayedBullish = bullishStocks.filter(filterMover)
  const displayedBearish = bearishStocks.filter(filterMover)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Search Command & Market Switcher */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <StockSearch market={market} onSelect={handleSelect} />
        </div>
        <MarketToggle market={market} onChange={setMarket} />
      </div>

      {/* Quick Market Movers Ribbon (Always accessible at top) */}
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none py-1 border-b border-gray-800/60 pb-2">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
          <Activity className="w-3.5 h-3.5 text-blue-400" /> Top Movers:
        </span>
        {bullishStocks.slice(0, 5).map((b) => (
          <button
            key={`ribbon-b-${b.ticker}`}
            onClick={() => handleSelectMover(b)}
            className="text-xs px-2.5 py-1 rounded-md bg-gray-900 border border-emerald-900/40 hover:border-emerald-500/70 text-gray-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0"
          >
            <span className="font-bold text-emerald-400">{b.ticker}</span>
            <span className="text-emerald-400 font-semibold text-[11px]">+{b.change_pct !== undefined ? b.change_pct.toFixed(1) : '0'}%</span>
            <span className="text-[9px] text-gray-500">· {b.market === 'US' ? 'US 🇺🇸' : b.market}</span>
          </button>
        ))}
        {bearishStocks.slice(0, 5).map((br) => (
          <button
            key={`ribbon-br-${br.ticker}`}
            onClick={() => handleSelectMover(br)}
            className="text-xs px-2.5 py-1 rounded-md bg-gray-900 border border-red-900/40 hover:border-red-500/70 text-gray-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0"
          >
            <span className="font-bold text-red-400">{br.ticker}</span>
            <span className="text-red-400 font-semibold text-[11px]">{br.change_pct !== undefined ? br.change_pct.toFixed(1) : '0'}%</span>
            <span className="text-[9px] text-gray-500">· {br.market === 'US' ? 'US 🇺🇸' : br.market}</span>
          </button>
        ))}
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

      {/* Stock Info Panel when Stock is Selected */}
      {selectedTicker ? (
        <>
          {loadingInfo ? (
            <div className="card flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : stockInfo ? (
            <div className="card bg-gradient-to-b from-gray-900 via-gray-900/95 to-gray-950 border border-gray-800/90 shadow-xl shadow-black/50">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-white">{selectedTicker}</h2>
                      <p className="text-sm text-gray-400">{stockInfo.name}</p>
                    </div>
                    <span className={clsx(
                      'text-xs px-2.5 py-1 rounded-full font-bold',
                      market === 'NSE' && 'bg-green-950/80 text-green-400 border border-green-800/60',
                      market === 'BSE' && 'bg-red-950/80 text-red-400 border border-red-800/60',
                      market === 'US' && 'bg-blue-950/80 text-blue-400 border border-blue-800/60'
                    )}>
                      {market === 'US' ? '🇺🇸 US Equities' : `${market} · India`}
                    </span>
                    <button onClick={toggleSave} className="text-gray-500 hover:text-yellow-400 transition-colors">
                      {isSaved ? <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" /> : <StarOff className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => setSelectedTicker('')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium underline ml-auto flex items-center gap-1"
                    >
                      ← Back to 5 Bullish & 5 Bearish Radar
                    </button>
                  </div>

                  <div className="mt-3.5 flex items-baseline gap-3">
                    <span className="text-4xl font-extrabold tracking-tight text-white font-mono">
                      {currencySymbol}{stockInfo.current_price !== undefined && stockInfo.current_price !== null ? stockInfo.current_price.toLocaleString('en-IN') : '—'}
                    </span>
                    {priceChangePct !== null && (
                      <span className={clsx(
                        'flex items-center gap-1 text-base font-bold px-2.5 py-0.5 rounded-lg border',
                        priceChangePct >= 0
                          ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60'
                          : 'bg-red-950/70 text-red-400 border-red-800/60'
                      )}>
                        {priceChangePct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-500 font-medium">
                    {stockInfo.sector && <span>{stockInfo.sector} · </span>}
                    {stockInfo.industry && <span>{stockInfo.industry} · </span>}
                    <span>Exchange Verified</span>
                  </div>
                </div>

                {/* Key Metrics & Verified Feed Badge */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-end gap-2.5 bg-gray-950/80 px-3 py-1.5 rounded-lg border border-gray-800 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px] bg-blue-950/80 border border-blue-800/70 px-2 py-0.5 rounded-md text-blue-300 font-semibold shadow-sm">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span>{liveSource}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={clsx("w-2 h-2 rounded-full", autoRefresh ? "bg-emerald-400 animate-ping" : "bg-gray-600")} />
                      <span className="text-gray-400 font-medium text-xs">
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
                        "text-[10px] px-2 py-0.5 rounded font-semibold border transition-colors",
                        autoRefresh ? "border-emerald-700 text-emerald-400 bg-emerald-950/30" : "border-gray-700 text-gray-500"
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm">
                    <Metric
                      label="Market Cap"
                      value={stockInfo.market_cap ? `${currencySymbol}${market === 'US' ? (stockInfo.market_cap / 1e9).toFixed(1) + 'B' : (stockInfo.market_cap / 1e7).toFixed(0) + 'Cr'}` : '—'}
                    />
                    <Metric label="P/E Ratio" value={stockInfo.pe_ratio ? `${stockInfo.pe_ratio.toFixed(2)}x` : '—'} />
                    <Metric label="P/B Ratio" value={stockInfo.pb_ratio ? `${stockInfo.pb_ratio.toFixed(2)}x` : '—'} />
                    <Metric label="52W High" value={stockInfo['52w_high'] ? `${currencySymbol}${stockInfo['52w_high'].toLocaleString('en-IN')}` : '—'} />
                    <Metric label="52W Low" value={stockInfo['52w_low'] ? `${currencySymbol}${stockInfo['52w_low'].toLocaleString('en-IN')}` : '—'} />
                    <Metric label="Beta" value={stockInfo.beta ? stockInfo.beta.toFixed(2) : '—'} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Period Selector + Candlestick/Line Chart */}
          {chartData.length > 0 && (
            <div className="card p-0 overflow-hidden border border-gray-800/90 shadow-xl">
              <div className="flex items-center gap-2 px-4 pt-4 border-b border-gray-800/50 pb-3">
                <span className="text-xs text-gray-500 font-semibold mr-1">Timeframe:</span>
                {['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={clsx(
                      'text-xs px-3 py-1 rounded-md transition-all font-semibold',
                      period === p
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'bg-gray-800/70 text-gray-400 hover:text-white hover:bg-gray-800'
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
                height={390}
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
            <div className="card space-y-3.5 border-gray-800/90">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-900/40 border border-blue-700/50 flex items-center justify-center text-blue-400">
                    <Newspaper className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-bold text-sm text-gray-200">Live Financial News & Sentiment Intelligence</h3>
                </div>
                <span className="text-[11px] text-gray-500 font-medium">Real-time RSS Wire · 1m Updates</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveNews.slice(0, 4).map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 bg-gray-900/60 hover:bg-gray-850 rounded-xl border border-gray-800 hover:border-gray-700 transition-all flex flex-col justify-between group shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span className="font-semibold text-gray-300">{item.source}</span>
                        <span className={clsx(
                          "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider",
                          item.sentiment === 'positive' && "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60",
                          item.sentiment === 'negative' && "bg-red-950/80 text-red-400 border border-red-800/60",
                          item.sentiment === 'neutral' && "bg-gray-800 text-gray-400 border border-gray-700"
                        )}>
                          {item.sentiment || 'neutral'}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-gray-200 group-hover:text-blue-400 transition-colors line-clamp-2 leading-relaxed">
                        {item.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-800 text-[10px] text-gray-500">
                      <span>{item.published_at ? new Date(item.published_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Verified Wire'}</span>
                      <span className="flex items-center gap-1 text-blue-400 font-semibold group-hover:underline">
                        Source article <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Start Research CTA */}
          <div className="card bg-gradient-to-r from-gray-900 via-gray-900 to-blue-950/40 border border-blue-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base text-white">Trigger Multi-Agent AI Audit</h3>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Deploys Fundamental, Technical, News, and Risk Analysis agents orchestrated by LangGraph Supervisor for <span className="text-white font-bold">{selectedTicker}</span> ({market})
              </p>
            </div>
            <button
              onClick={handleStartResearch}
              disabled={researchLoading || researchTask?.status === 'running'}
              className="btn-primary flex items-center gap-2 whitespace-nowrap text-sm px-5 py-2.5"
            >
              {researchLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Agents Analyzing...</>
              ) : (
                <><Play className="w-4 h-4" /> Run 4-Agent Research</>
              )}
            </button>
          </div>

          {/* Agent Progress */}
          {researchTask && (
            <div>
              <h3 className="font-bold mb-3 text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" /> Autonomous Agent Orchestration Pipeline
              </h3>
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
        /* ── Landing Page (After Login): 5 Bullish & 5 Bearish Stocks Executive Board ── */
        <div className="space-y-8">
          {/* Executive Cockpit Hero Banner */}
          <div className="card bg-gradient-to-r from-gray-950 via-gray-900 to-indigo-950/40 border-gray-800/90 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Terminal Active
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-950/80 text-blue-400 border border-blue-800/60 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-yellow-400" /> Alpha Vantage Connected
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-950/80 text-purple-400 border border-purple-800/60">
                    NSE · BSE · US Stocks
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Institutional Market Radar & AI Screener
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                  Real-time equity momentum tracking top accumulation leaders and downside risk targets. Select any stock below to launch live 1-minute candlestick charting, indicator overlays, and autonomous multi-agent financial audits.
                </p>
              </div>

              {/* Market Scope Toggle */}
              <div className="flex items-center gap-2 bg-gray-950/80 p-1.5 rounded-xl border border-gray-800/90 self-start lg:self-center shadow-inner">
                <span className="text-[11px] font-bold text-gray-500 px-2 uppercase tracking-wider">Filter:</span>
                <button
                  type="button"
                  onClick={() => setMoversMarketFilter('ALL')}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-lg font-bold transition-all',
                    moversMarketFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  )}
                >
                  Global (All)
                </button>
                <button
                  type="button"
                  onClick={() => setMoversMarketFilter('IN')}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-lg font-bold transition-all',
                    moversMarketFilter === 'IN'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  )}
                >
                  🇮🇳 NSE / BSE
                </button>
                <button
                  type="button"
                  onClick={() => setMoversMarketFilter('US')}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1',
                    moversMarketFilter === 'US'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  )}
                >
                  <span>🇺🇸</span> US Equities
                </button>
              </div>
            </div>
          </div>

          {loadingMovers ? (
            <div className="card flex flex-col items-center justify-center py-24 space-y-3">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm font-semibold text-gray-400">Scanning Real-Time Exchange Gateways...</p>
            </div>
          ) : (
            /* ── DUAL COCKPIT: 5 BULLISH (LEFT) vs 5 BEARISH (RIGHT) ── */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 🟢 TOP 5 BULLISH STOCKS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-950">
                      <Flame className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        Top 5 Bullish Accumulation Plays
                      </h3>
                      <p className="text-[11px] text-gray-500 font-medium">Strong positive momentum & institutional buying</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                    BUY SIGNALS
                  </span>
                </div>

                <div className="space-y-2.5">
                  {displayedBullish.slice(0, 5).map((stock, idx) => (
                    <div
                      key={`bullish-${stock.market}-${stock.ticker}`}
                      onClick={() => handleSelectMover(stock)}
                      className="card-bullish cursor-pointer flex items-center justify-between group hover:scale-[1.01] hover:bg-gray-900 transition-all border border-emerald-900/30 hover:border-emerald-500"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank */}
                        <div className="w-7 h-7 rounded-md bg-emerald-950/90 border border-emerald-800/60 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-white group-hover:text-emerald-400 transition-colors">
                              {stock.ticker}
                            </span>
                            <span className={clsx(
                              'text-[10px] px-2 py-0.5 rounded font-bold uppercase',
                              stock.market === 'NSE' && 'bg-green-950/70 text-green-300 border border-green-800/60',
                              stock.market === 'BSE' && 'bg-red-950/70 text-red-300 border border-red-800/60',
                              stock.market === 'US' && 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                            )}>
                              {stock.market === 'US' ? '🇺🇸 US' : stock.market}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate max-w-[190px] sm:max-w-xs">{stock.name}</p>
                        </div>
                      </div>

                      {/* Right Details */}
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <div className="font-mono font-bold text-sm text-gray-100">
                            {stock.currency === 'USD' ? '$' : '₹'}{stock.current_price?.toLocaleString('en-IN') ?? '—'}
                          </div>
                          <span className="text-[10px] text-emerald-400/90 font-medium block">
                            {stock.signal || 'High Momentum'}
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-emerald-300 bg-emerald-950/90 border border-emerald-700/60 px-2.5 py-1 rounded-lg flex items-center gap-0.5 shadow-sm">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            +{stock.change_pct !== undefined ? stock.change_pct.toFixed(2) : '0.00'}%
                          </span>
                          <span className="text-[9px] text-gray-500 mt-0.5 group-hover:text-blue-400 transition-colors flex items-center gap-0.5">
                            Launch Terminal →
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 🔴 TOP 5 BEARISH STOCKS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400 shadow-md shadow-red-950">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-red-400 uppercase tracking-wider flex items-center gap-2">
                        Top 5 Bearish Pullback Targets
                      </h3>
                      <p className="text-[11px] text-gray-500 font-medium">Selling pressure & downside risk warnings</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-950/50 text-red-400 border border-red-800/40">
                    SELL / RISK
                  </span>
                </div>

                <div className="space-y-2.5">
                  {displayedBearish.slice(0, 5).map((stock, idx) => (
                    <div
                      key={`bearish-${stock.market}-${stock.ticker}`}
                      onClick={() => handleSelectMover(stock)}
                      className="card-bearish cursor-pointer flex items-center justify-between group hover:scale-[1.01] hover:bg-gray-900 transition-all border border-red-900/30 hover:border-red-500"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank */}
                        <div className="w-7 h-7 rounded-md bg-red-950/90 border border-red-800/60 text-red-400 font-black text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-white group-hover:text-red-400 transition-colors">
                              {stock.ticker}
                            </span>
                            <span className={clsx(
                              'text-[10px] px-2 py-0.5 rounded font-bold uppercase',
                              stock.market === 'NSE' && 'bg-green-950/70 text-green-300 border border-green-800/60',
                              stock.market === 'BSE' && 'bg-red-950/70 text-red-300 border border-red-800/60',
                              stock.market === 'US' && 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                            )}>
                              {stock.market === 'US' ? '🇺🇸 US' : stock.market}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate max-w-[190px] sm:max-w-xs">{stock.name}</p>
                        </div>
                      </div>

                      {/* Right Details */}
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <div className="font-mono font-bold text-sm text-gray-100">
                            {stock.currency === 'USD' ? '$' : '₹'}{stock.current_price?.toLocaleString('en-IN') ?? '—'}
                          </div>
                          <span className="text-[10px] text-red-400/90 font-medium block">
                            {stock.signal || 'Downside Pressure'}
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-red-300 bg-red-950/90 border border-red-700/60 px-2.5 py-1 rounded-lg flex items-center gap-0.5 shadow-sm">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            {stock.change_pct !== undefined ? stock.change_pct.toFixed(2) : '-0.00'}%
                          </span>
                          <span className="text-[9px] text-gray-500 mt-0.5 group-hover:text-blue-400 transition-colors flex items-center gap-0.5">
                            Launch Terminal →
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Trader Confidence & Institutional Integrity Matrix ── */}
          <div className="card bg-gray-950/80 border border-gray-800/80 pt-6 pb-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800/80 mb-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                  Trader Confidence & Mathematical Integrity Guarantee
                </h3>
              </div>
              <span className="text-xs text-gray-400 font-medium hidden sm:inline">
                Built for professional traders & financial analysts
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800/60 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" /> Deterministic Math
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Financial ratios (P/E, ROE, Margins) and indicators (RSI-14, MACD, VaR) computed via NumPy/Pandas. No LLM calculation hallucinations.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800/60 space-y-1.5">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-yellow-400" /> Alpha Vantage Feed
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Real-time market quotes verified through Alpha Vantage API with continuous minute-by-minute streaming and historical accuracy.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800/60 space-y-1.5">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                  <Layers className="w-4 h-4" /> LangGraph Supervisor
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Wave-based execution: Fundamental, Technical, and News agents run in parallel, supervised by dynamic state graph orchestration.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800/60 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Lock className="w-4 h-4" /> Conflict Detection
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Autonomous Risk Agent detects opposing signals—such as overbought RSI with negative margins—saving traders from false breakout traps.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-950/70 border border-gray-800/80 rounded-lg px-3 py-2">
      <p className="text-[11px] text-gray-500 font-semibold">{label}</p>
      <p className="font-bold text-sm text-gray-100 mt-0.5 font-mono">{value}</p>
    </div>
  )
}
