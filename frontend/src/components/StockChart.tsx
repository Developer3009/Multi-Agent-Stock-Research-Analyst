import React, { useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import clsx from 'clsx'
import type { OHLCVPoint } from '../types'
import { useTheme } from '../context/ThemeContext'

interface SMAData {
  sma20?: (number | null)[]
  sma50?: (number | null)[]
  dates?: string[]
}

interface Props {
  data: OHLCVPoint[]
  ticker: string
  market: string
  height?: number
  sma?: SMAData
}

type LineStyle = 'area' | 'spline' | 'baseline' | 'step'

export default function StockChart({ data, ticker, market, height = 420, sma }: Props) {
  const [chartType, setChartType] = useState<'candle' | 'line'>('line')
  const [lineStyle, setLineStyle] = useState<LineStyle>('area')
  const [showHighLow, setShowHighLow] = useState(true)
  const [showBollinger, setShowBollinger] = useState(false)
  const [showSMA20, setShowSMA20] = useState(true)
  const [showSMA50, setShowSMA50] = useState(false)
  const [showVWAP, setShowVWAP] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const currencySymbol = market === 'US' ? '$' : '₹'

  // Extract core time series arrays
  const { dates, opens, highs, lows, closes, volumes } = useMemo(() => {
    return {
      dates: data.map((d) => d.date),
      opens: data.map((d) => d.open),
      highs: data.map((d) => d.high),
      lows: data.map((d) => d.low),
      closes: data.map((d) => d.close),
      volumes: data.map((d) => d.volume),
    }
  }, [data])

  // Trend detection over dataset
  const startPrice = closes.length > 0 ? closes[0] : 0
  const latestPrice = closes.length > 0 ? closes[closes.length - 1] : 0
  const netChange = latestPrice - startPrice
  const netChangePercent = startPrice > 0 ? (netChange / startPrice) * 100 : 0
  const isBullish = netChange >= 0

  // Peak (High) and Trough (Low) calculation
  const { maxPoint, minPoint } = useMemo(() => {
    if (data.length === 0) return { maxPoint: null, minPoint: null }
    let maxIdx = 0
    let minIdx = 0
    for (let i = 1; i < data.length; i++) {
      if (data[i].high > data[maxIdx].high) maxIdx = i
      if (data[i].low < data[minIdx].low) minIdx = i
    }
    return {
      maxPoint: { date: data[maxIdx].date, price: data[maxIdx].high },
      minPoint: { date: data[minIdx].date, price: data[minIdx].low },
    }
  }, [data])

  // Moving Average & Technical calculations
  const { calcSMA20, calcSMA50, upperBB, lowerBB, vwapSeries } = useMemo(() => {
    const s20: (number | null)[] = []
    const s50: (number | null)[] = []
    const bbU: (number | null)[] = []
    const bbL: (number | null)[] = []
    const vwap: (number | null)[] = []

    let cumVol = 0
    let cumVolPrice = 0

    for (let i = 0; i < closes.length; i++) {
      // VWAP calculation
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3
      cumVol += volumes[i] || 0
      cumVolPrice += typicalPrice * (volumes[i] || 0)
      vwap.push(cumVol > 0 ? cumVolPrice / cumVol : closes[i])

      // SMA 20 & Bollinger Bands (window 20, multiplier 2)
      if (i >= 19) {
        const window20 = closes.slice(i - 19, i + 1)
        const mean20 = window20.reduce((a, b) => a + b, 0) / 20
        s20.push(mean20)

        const variance = window20.reduce((acc, val) => acc + Math.pow(val - mean20, 2), 0) / 20
        const stdDev = Math.sqrt(variance)
        bbU.push(mean20 + 2 * stdDev)
        bbL.push(mean20 - 2 * stdDev)
      } else {
        s20.push(null)
        bbU.push(null)
        bbL.push(null)
      }

      // SMA 50
      if (i >= 49) {
        const window50 = closes.slice(i - 49, i + 1)
        s50.push(window50.reduce((a, b) => a + b, 0) / 50)
      } else {
        s50.push(null)
      }
    }

    return {
      calcSMA20: s20,
      calcSMA50: s50,
      upperBB: bbU,
      lowerBB: bbL,
      vwapSeries: vwap,
    }
  }, [closes, highs, lows, volumes])

  // Custom data matrix for hover template
  const customDataMatrix = useMemo(() => {
    return closes.map((c, i) => [
      c - startPrice,
      startPrice > 0 ? ((c - startPrice) / startPrice) * 100 : 0,
      highs[i],
      lows[i],
      volumes[i],
    ])
  }, [closes, highs, lows, volumes, startPrice])

  // Primary Candlestick Trace
  const candlestick: Plotly.Data = {
    type: 'candlestick',
    x: dates,
    open: opens,
    high: highs,
    low: lows,
    close: closes,
    name: `${ticker} Price`,
    increasing: { line: { color: '#22c55e', width: 1.5 }, fillcolor: '#22c55e' },
    decreasing: { line: { color: '#ef4444', width: 1.5 }, fillcolor: '#ef4444' },
    hoverlabel: {
      bgcolor: '#111827',
      bordercolor: '#374151',
      font: { family: 'ui-monospace, SFMono-Regular, monospace', size: 12, color: '#f3f4f6' },
    },
  }

  // Dynamic Theme Colors for Line Chart
  const linePrimaryColor = isBullish ? '#10b981' : '#f43f5e'
  const lineFillColor = isBullish ? 'rgba(16, 185, 129, 0.16)' : 'rgba(244, 63, 94, 0.16)'

  // Dynamic Line Trace based on representation style
  const lineTrace: Plotly.Data = {
    type: 'scatter',
    mode: 'lines',
    x: dates,
    y: closes,
    name: `${ticker} Price`,
    line: {
      color: linePrimaryColor,
      width: 2.75,
      shape: lineStyle === 'spline' ? 'spline' : lineStyle === 'step' ? 'hv' : 'linear',
      ...(lineStyle === 'spline' ? { smoothing: 0.85 } : {}),
    },
    fill: lineStyle === 'baseline' ? 'tonexty' : 'tozeroy',
    fillcolor: lineFillColor,
    customdata: customDataMatrix,
    hovertemplate:
      `<b>%{x}</b><br>` +
      `Price: <b>${currencySymbol}%{y:,.2f}</b><br>` +
      `Change from Open: <b>%{customdata[0]:+,.2f} (%{customdata[1]:+.2f}%)</b><br>` +
      `High: ${currencySymbol}%{customdata[2]:,.2f} · Low: ${currencySymbol}%{customdata[3]:,.2f}<br>` +
      `Volume: %{customdata[4]:,}` +
      `<extra></extra>`,
    hoverlabel: {
      bgcolor: '#0f172a',
      bordercolor: linePrimaryColor,
      font: { family: 'ui-monospace, SFMono-Regular, monospace', size: 12, color: '#f8fafc' },
    },
  }

  // Volume Bar Chart (aligned with candlestick / line movement)
  const volumeBar: Plotly.Data = {
    type: 'bar',
    x: dates,
    y: volumes,
    name: 'Volume',
    marker: {
      color: closes.map((c, i) =>
        i === 0 ? '#64748b' : c >= opens[i] ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)'
      ),
    },
    yaxis: 'y2',
    hoverinfo: 'x+y',
    hoverlabel: { bgcolor: '#1e293b', font: { color: '#cbd5e1' } },
  }

  // Overlay Traces (Bollinger Bands, SMAs, VWAP)
  const overlayTraces: Plotly.Data[] = []

  // Bollinger Bands Volatility Cloud
  if (showBollinger && upperBB.length > 0) {
    overlayTraces.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: lowerBB,
      name: 'Lower Band (2σ)',
      line: { color: 'rgba(56, 189, 248, 0.35)', width: 1, dash: 'dot' },
      hoverinfo: 'none',
      showlegend: false,
    } as Plotly.Data)

    overlayTraces.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: upperBB,
      name: 'Bollinger Bands (20, 2σ)',
      line: { color: 'rgba(56, 189, 248, 0.35)', width: 1, dash: 'dot' },
      fill: 'tonexty',
      fillcolor: 'rgba(56, 189, 248, 0.06)',
      hoverinfo: 'none',
    } as Plotly.Data)
  }

  // SMA 20
  if (showSMA20) {
    const sma20Values = sma?.sma20 && sma.dates ? sma.sma20 : calcSMA20
    const smaDates = sma?.dates || dates
    overlayTraces.push({
      type: 'scatter',
      mode: 'lines',
      x: smaDates,
      y: sma20Values,
      name: 'SMA 20',
      line: { color: '#f59e0b', width: 1.5 },
      connectgaps: false,
      hoverinfo: 'skip',
    } as Plotly.Data)
  }

  // SMA 50
  if (showSMA50) {
    const sma50Values = sma?.sma50 && sma.dates ? sma.sma50 : calcSMA50
    const smaDates = sma?.dates || dates
    overlayTraces.push({
      type: 'scatter',
      mode: 'lines',
      x: smaDates,
      y: sma50Values,
      name: 'SMA 50',
      line: { color: '#a855f7', width: 1.5, dash: 'dash' },
      connectgaps: false,
      hoverinfo: 'skip',
    } as Plotly.Data)
  }

  // VWAP Overlay
  if (showVWAP) {
    overlayTraces.push({
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: vwapSeries,
      name: 'VWAP',
      line: { color: '#06b6d4', width: 1.5, dash: 'dot' },
      connectgaps: false,
      hoverinfo: 'skip',
    } as Plotly.Data)
  }

  // Annotations for Period High & Low Pins
  const annotations: any[] = []
  if (showHighLow && maxPoint && minPoint && data.length > 3) {
    annotations.push({
      x: maxPoint.date,
      y: maxPoint.price,
      xref: 'x',
      yref: 'y',
      text: `▲ High ${currencySymbol}${maxPoint.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      showarrow: true,
      arrowhead: 2,
      arrowsize: 1,
      arrowwidth: 1.5,
      arrowcolor: '#10b981',
      ax: 0,
      ay: -24,
      bgcolor: 'rgba(6, 78, 59, 0.95)',
      bordercolor: '#10b981',
      borderwidth: 1,
      borderpad: 4,
      font: { color: '#a7f3d0', size: 10, family: 'sans-serif' },
    })

    annotations.push({
      x: minPoint.date,
      y: minPoint.price,
      xref: 'x',
      yref: 'y',
      text: `▼ Low ${currencySymbol}${minPoint.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      showarrow: true,
      arrowhead: 2,
      arrowsize: 1,
      arrowwidth: 1.5,
      arrowcolor: '#ef4444',
      ax: 0,
      ay: 24,
      bgcolor: 'rgba(127, 29, 29, 0.95)',
      bordercolor: '#ef4444',
      borderwidth: 1,
      borderpad: 4,
      font: { color: '#fecaca', size: 10, family: 'sans-serif' },
    })
  }

  // Subtle horizontal guides for Last Price & Period Open Baseline
  const shapes: Partial<Plotly.Shape>[] = []
  if (latestPrice > 0) {
    shapes.push({
      type: 'line',
      xref: 'paper',
      x0: 0,
      x1: 1,
      yref: 'y',
      y0: latestPrice,
      y1: latestPrice,
      line: {
        color: isBullish ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
        width: 1,
        dash: 'dash',
      },
    })
  }

  if (lineStyle === 'baseline' && startPrice > 0) {
    shapes.push({
      type: 'line',
      xref: 'paper',
      x0: 0,
      x1: 1,
      yref: 'y',
      y0: startPrice,
      y1: startPrice,
      line: {
        color: 'rgba(148, 163, 184, 0.5)',
        width: 1,
        dash: 'dot',
      },
    })
  }

  const layout: Partial<Plotly.Layout> = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: isDark ? '#94a3b8' : '#475569', size: 11, family: 'Inter, system-ui, sans-serif' },
    xaxis: {
      type: 'date',
      gridcolor: isDark ? '#1e293b' : '#e2e8f0',
      linecolor: isDark ? '#334155' : '#cbd5e1',
      rangeslider: { visible: false },
      tickfont: { color: isDark ? '#94a3b8' : '#64748b', size: 10 },
    },
    yaxis: {
      gridcolor: isDark ? '#1e293b' : '#e2e8f0',
      linecolor: isDark ? '#334155' : '#cbd5e1',
      title: {
        text: market === 'US' ? 'Price (USD $)' : 'Price (INR ₹)',
        font: { color: isDark ? '#94a3b8' : '#475569', size: 11 },
      },
      domain: [0.22, 1],
      tickfont: { color: isDark ? '#94a3b8' : '#64748b', size: 10 },
      tickformat: ',.2f',
    },
    yaxis2: {
      gridcolor: isDark ? '#1e293b' : '#e2e8f0',
      linecolor: isDark ? '#334155' : '#cbd5e1',
      title: { text: 'Volume', font: { color: isDark ? '#64748b' : '#94a3b8', size: 10 } },
      domain: [0, 0.18],
      tickfont: { color: isDark ? '#64748b' : '#94a3b8', size: 9 },
    },
    legend: {
      orientation: 'h',
      x: 0,
      y: -0.15,
      font: { color: isDark ? '#94a3b8' : '#475569', size: 11 },
      bgcolor: 'transparent',
    },
    margin: { l: 55, r: 25, t: 15, b: 35 },
    hovermode: 'x unified',
    annotations,
    shapes,
  }

  // Active data point for the interactive HUD header
  const activeIdx = hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < data.length
    ? hoveredIndex
    : data.length - 1

  const activePoint = data[activeIdx] || null
  const activePrice = activePoint ? activePoint.close : latestPrice
  const activeDiff = activePrice - startPrice
  const activePct = startPrice > 0 ? (activeDiff / startPrice) * 100 : 0
  const activeIsBullish = activeDiff >= 0

  return (
    <div
      className={clsx(
        'flex flex-col w-full rounded-xl border overflow-hidden shadow-lg backdrop-blur-sm transition-colors',
        isDark
          ? 'bg-gray-900/40 border-gray-800/80'
          : 'bg-white border-slate-200'
      )}
    >
      {/* ── TOP INTERACTIVE DATA HUD (HEADS-UP DISPLAY) ── */}
      <div
        className={clsx(
          'flex flex-wrap items-center justify-between px-4 py-2.5 border-b gap-3 transition-colors',
          isDark ? 'bg-gray-900/90 border-gray-800' : 'bg-slate-50 border-slate-200'
        )}
      >
        {/* Left: Live Price & Dynamics */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span
              className={clsx(
                'text-xs font-semibold uppercase tracking-wider',
                isDark ? 'text-gray-400' : 'text-slate-500'
              )}
            >
              {ticker}
            </span>
            <span
              className={clsx(
                'text-xl font-bold tracking-tight',
                isDark ? 'text-white' : 'text-slate-900'
              )}
            >
              {currencySymbol}{activePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div
            className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-colors',
              activeIsBullish
                ? isDark
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : isDark
                ? 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            )}
          >
            <span>{activeIsBullish ? '▲ +' : '▼ '}</span>
            <span>{currencySymbol}{Math.abs(activeDiff).toFixed(2)}</span>
            <span>({activeIsBullish ? '+' : ''}{activePct.toFixed(2)}%)</span>
          </div>

          {activePoint && (
            <span
              className={clsx(
                'text-[11px] hidden sm:inline-block',
                isDark ? 'text-gray-500' : 'text-slate-400'
              )}
            >
              {new Date(activePoint.date).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Right: Key Session Range (O / H / L / V) */}
        {activePoint && (
          <div
            className={clsx(
              'flex items-center gap-3 text-[11px]',
              isDark ? 'text-gray-400' : 'text-slate-600'
            )}
          >
            <div>
              <span className={isDark ? 'text-gray-500 font-medium' : 'text-slate-400 font-medium'}>O: </span>
              <span className={clsx('font-semibold', isDark ? 'text-gray-300' : 'text-slate-800')}>{currencySymbol}{activePoint.open.toFixed(2)}</span>
            </div>
            <div>
              <span className={isDark ? 'text-gray-500 font-medium' : 'text-slate-400 font-medium'}>H: </span>
              <span className="font-semibold text-emerald-500">{currencySymbol}{activePoint.high.toFixed(2)}</span>
            </div>
            <div>
              <span className={isDark ? 'text-gray-500 font-medium' : 'text-slate-400 font-medium'}>L: </span>
              <span className="font-semibold text-rose-500">{currencySymbol}{activePoint.low.toFixed(2)}</span>
            </div>
            <div>
              <span className={isDark ? 'text-gray-500 font-medium' : 'text-slate-400 font-medium'}>Vol: </span>
              <span className="font-semibold text-blue-500">
                {activePoint.volume >= 1e6
                  ? `${(activePoint.volume / 1e6).toFixed(2)}M`
                  : activePoint.volume >= 1e3
                  ? `${(activePoint.volume / 1e3).toFixed(1)}K`
                  : activePoint.volume}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── TOOLBAR: CHART TYPE & DATA REPRESENTATION CONTROLS ── */}
      <div
        className={clsx(
          'flex flex-wrap items-center justify-between px-4 py-1.5 border-b gap-2 text-xs transition-colors',
          isDark ? 'bg-gray-950/70 border-gray-800/60' : 'bg-slate-100/70 border-slate-200'
        )}
      >
        {/* Chart View Switcher */}
        <div
          className={clsx(
            'flex items-center gap-1 p-0.5 rounded-lg border',
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-slate-200'
          )}
        >
          <button
            type="button"
            onClick={() => setChartType('line')}
            className={clsx(
              'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
              chartType === 'line'
                ? 'bg-[#059669] text-white shadow-sm shadow-emerald-700/30'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <span>📈</span> Line & Area
          </button>
          <button
            type="button"
            onClick={() => setChartType('candle')}
            className={clsx(
              'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
              chartType === 'candle'
                ? 'bg-[#059669] text-white shadow-sm shadow-emerald-700/30'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <span>📊</span> Candlestick
          </button>
        </div>

        {/* Visual Line Styles (Visible in Line Mode) */}
        {chartType === 'line' && (
          <div
            className={clsx(
              'flex items-center gap-1 p-0.5 rounded-lg border',
              isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white border-slate-200'
            )}
          >
            <span className={clsx('text-[10px] font-semibold px-1.5 uppercase', isDark ? 'text-gray-500' : 'text-slate-400')}>Style:</span>
            {(
              [
                { id: 'area', label: 'Area Glow' },
                { id: 'spline', label: 'Spline' },
                { id: 'baseline', label: 'Baseline' },
                { id: 'step', label: 'Step' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setLineStyle(st.id)}
                className={clsx(
                  'px-2 py-0.5 rounded text-[11px] font-medium transition-all',
                  lineStyle === st.id
                    ? isDark
                      ? 'bg-gray-800 text-emerald-400 font-semibold border border-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-300'
                    : isDark
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}

        {/* Technical Overlays Toggles */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setShowHighLow((prev) => !prev)}
            className={clsx(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-all border',
              showHighLow
                ? isDark
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold'
                : isDark
                ? 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
            title="Display peak period High and trough Low markers with callouts"
          >
            📌 High/Low Pins
          </button>

          <button
            type="button"
            onClick={() => setShowBollinger((prev) => !prev)}
            className={clsx(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-all border',
              showBollinger
                ? isDark
                  ? 'bg-sky-950/60 text-sky-300 border-sky-500/40'
                  : 'bg-sky-100 text-sky-800 border-sky-300 font-semibold'
                : isDark
                ? 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
            title="Bollinger Bands (20, 2σ) volatility envelope"
          >
            ☁️ BBands
          </button>

          <button
            type="button"
            onClick={() => setShowSMA20((prev) => !prev)}
            className={clsx(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-all border',
              showSMA20
                ? isDark
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                  : 'bg-amber-100 text-amber-800 border-amber-300 font-semibold'
                : isDark
                ? 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
            title="20-period Simple Moving Average"
          >
            〰️ SMA 20
          </button>

          <button
            type="button"
            onClick={() => setShowSMA50((prev) => !prev)}
            className={clsx(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-all border',
              showSMA50
                ? isDark
                  ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                  : 'bg-purple-100 text-purple-800 border-purple-300 font-semibold'
                : isDark
                ? 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
            title="50-period Simple Moving Average"
          >
            〰️ SMA 50
          </button>

          <button
            type="button"
            onClick={() => setShowVWAP((prev) => !prev)}
            className={clsx(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-all border',
              showVWAP
                ? isDark
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                  : 'bg-cyan-100 text-cyan-800 border-cyan-300 font-semibold'
                : isDark
                ? 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
            title="Volume-Weighted Average Price benchmark"
          >
            📉 VWAP
          </button>
        </div>
      </div>

      {/* ── PLOTLY CHART CANVAS ── */}
      <div className="relative w-full">
        <Plot
          data={[
            chartType === 'candle' ? candlestick : lineTrace,
            ...overlayTraces,
            volumeBar,
          ]}
          layout={layout}
          config={{
            responsive: true,
            displayModeBar: false,
          }}
          onHover={(eventData: any) => {
            if (eventData?.points && eventData.points.length > 0) {
              const pt = eventData.points[0]
              if (typeof pt.pointIndex === 'number') {
                setHoveredIndex(pt.pointIndex)
              }
            }
          }}
          onUnhover={() => {
            setHoveredIndex(null)
          }}
          style={{ width: '100%', height }}
          useResizeHandler
        />
      </div>
    </div>
  )
}
