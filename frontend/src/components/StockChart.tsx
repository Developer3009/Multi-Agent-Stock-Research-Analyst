import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import type { OHLCVPoint } from '../types'

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

export default function StockChart({ data, ticker, market, height = 400, sma }: Props) {
  const { dates, opens, highs, lows, closes, volumes } = useMemo(() => ({
    dates: data.map((d) => d.date),
    opens: data.map((d) => d.open),
    highs: data.map((d) => d.high),
    lows: data.map((d) => d.low),
    closes: data.map((d) => d.close),
    volumes: data.map((d) => d.volume),
  }), [data])

  const candlestick: Plotly.Data = {
    type: 'candlestick',
    x: dates,
    open: opens,
    high: highs,
    low: lows,
    close: closes,
    name: `${ticker} (${market})`,
    increasing: { line: { color: '#22c55e' } },
    decreasing: { line: { color: '#ef4444' } },
  }

  const volumeBar: Plotly.Data = {
    type: 'bar',
    x: dates,
    y: volumes,
    name: 'Volume',
    marker: {
      color: closes.map((c, i) =>
        i === 0 ? '#6b7280' : c >= opens[i] ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'
      ),
    },
    yaxis: 'y2',
  }

  // SMA overlays
  const smaTraces: Plotly.Data[] = []
  if (sma?.sma20 && sma.dates) {
    smaTraces.push({
      type: 'scatter',
      mode: 'lines',
      x: sma.dates,
      y: sma.sma20,
      name: 'SMA 20',
      line: { color: '#f59e0b', width: 1.5, dash: 'solid' },
      connectgaps: false,
    } as Plotly.Data)
  }
  if (sma?.sma50 && sma.dates) {
    smaTraces.push({
      type: 'scatter',
      mode: 'lines',
      x: sma.dates,
      y: sma.sma50,
      name: 'SMA 50',
      line: { color: '#8b5cf6', width: 1.5, dash: 'dot' },
      connectgaps: false,
    } as Plotly.Data)
  }

  const layout: Partial<Plotly.Layout> = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#9ca3af', size: 12 },
    title: {
      text: `${ticker} · ${market}`,
      font: { color: '#f9fafb', size: 16 },
    },
    xaxis: {
      type: 'date',
      gridcolor: '#1f2937',
      linecolor: '#374151',
      rangeslider: { visible: false },
    },
    yaxis: {
      gridcolor: '#1f2937',
      linecolor: '#374151',
      title: { text: 'Price (INR)', font: { color: '#9ca3af' } },
      domain: [0.25, 1],
    },
    yaxis2: {
      gridcolor: '#1f2937',
      linecolor: '#374151',
      title: { text: 'Volume', font: { color: '#9ca3af' } },
      domain: [0, 0.2],
    },
    legend: { orientation: 'h', y: -0.05, font: { color: '#9ca3af' } },
    margin: { l: 60, r: 20, t: 50, b: 30 },
    hovermode: 'x unified',
  }

  return (
    <Plot
      data={[candlestick, ...smaTraces, volumeBar]}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: '100%', height }}
      useResizeHandler
    />
  )
}
