import React, { useEffect, useRef } from 'react'

interface Point {
  x: number
  y: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  time: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
  color: string
}

interface TradeRipple {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  text: string
  isBuy: boolean
}

export default function InteractiveStockCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  
  // Direct DOM refs to skip React re-rendering on mousemove
  const priceDisplayRef = useRef<HTMLSpanElement | null>(null)
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null)
  const assetBtnNiftyRef = useRef<HTMLButtonElement | null>(null)
  const assetBtnRelRef = useRef<HTMLButtonElement | null>(null)
  const assetBtnNvdaRef = useRef<HTMLButtonElement | null>(null)

  // Internal animation state via refs (0 React state updates during mouse movements)
  const mousePosRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -100,
    y: -100,
    active: false,
  })
  const activeAssetRef = useRef<'NIFTY' | 'RELIANCE' | 'NVDA'>('NIFTY')
  const pointsRef = useRef<Point[]>([])
  const particlesRef = useRef<Particle[]>([])
  const ripplesRef = useRef<TradeRipple[]>([])
  const animFrameId = useRef<number | null>(null)
  const currentPriceRef = useRef<number>(24360.5)

  // Helper to rebuild synthetic points when asset changes
  function generatePoints(asset: 'NIFTY' | 'RELIANCE' | 'NVDA') {
    const pts: Point[] = []
    let basePrice = asset === 'NVDA' ? 162.85 : asset === 'RELIANCE' ? 1339.7 : 24360.5
    currentPriceRef.current = basePrice
    const count = 64

    for (let i = 0; i < count; i++) {
      const delta = (Math.sin(i * 0.22) * 0.7 + (Math.random() - 0.48) * 0.8) * (basePrice * 0.0035)
      const open = basePrice
      const close = basePrice + delta
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.002)
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.002)
      const volume = Math.floor(Math.random() * 60000) + 15000

      const hour = 9 + Math.floor(i / 10)
      const min = (i % 10) * 6
      const timeStr = `${hour.toString().padStart(2, '0')}:${Math.floor(min).toString().padStart(2, '0')}`

      pts.push({
        x: i,
        y: close,
        open,
        high,
        low,
        close,
        volume,
        time: timeStr,
      })

      basePrice = close
    }

    pointsRef.current = pts
    updatePriceDOM(pts[pts.length - 1].close, pts[pts.length - 1].time)
  }

  function updatePriceDOM(price: number, time: string) {
    const sym = activeAssetRef.current === 'NVDA' ? '$' : '₹'
    if (priceDisplayRef.current) {
      priceDisplayRef.current.textContent = `${sym}${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = time
    }
  }

  function setAsset(asset: 'NIFTY' | 'RELIANCE' | 'NVDA') {
    activeAssetRef.current = asset
    generatePoints(asset)

    // Update active button classes directly without React re-render
    const btns = [
      { ref: assetBtnNiftyRef, name: 'NIFTY' },
      { ref: assetBtnRelRef, name: 'RELIANCE' },
      { ref: assetBtnNvdaRef, name: 'NVDA' },
    ]
    btns.forEach(({ ref, name }) => {
      if (!ref.current) return
      if (name === asset) {
        ref.current.className =
          'text-xs px-3 py-1 rounded-lg font-bold bg-blue-600 text-white shadow-md shadow-blue-500/30 transition-all'
      } else {
        ref.current.className =
          'text-xs px-3 py-1 rounded-lg font-bold bg-gray-800/80 text-gray-400 hover:text-white transition-all'
      }
    })
  }

  useEffect(() => {
    generatePoints('NIFTY')
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    function handleResize() {
      if (!canvas || !containerRef.current || !ctx) return
      const rect = containerRef.current.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    function render() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, width, height)

      // Background subtle financial grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)'
      ctx.lineWidth = 1
      const xStep = Math.max(width / 10, 60)
      const yStep = Math.max(height / 8, 45)

      for (let x = 0; x <= width; x += xStep) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      for (let y = 0; y <= height; y += yStep) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      const pts = pointsRef.current
      const mouse = mousePosRef.current

      if (pts.length > 1) {
        const minVal = Math.min(...pts.map((p) => p.low)) * 0.998
        const maxVal = Math.max(...pts.map((p) => p.high)) * 1.002
        const valRange = maxVal - minVal || 1

        const paddingX = 40
        const paddingY = 80
        const chartW = width - paddingX * 2
        const chartH = height - paddingY * 2

        // Project points to canvas coordinates with elastic mouse attraction
        const projected = pts.map((p, idx) => {
          const px = paddingX + (idx / (pts.length - 1)) * chartW
          let yVal = p.close
          if (mouse.active) {
            const dist = Math.abs(px - mouse.x)
            if (dist < 140) {
              const influence = (1 - dist / 140) * 10
              yVal += (mouse.y < height / 2 ? 1 : -1) * influence
            }
          }
          const py = paddingY + chartH - ((yVal - minVal) / valRange) * chartH
          return { ...p, px, py }
        })

        // Draw Volume Histogram Bars
        const maxVol = Math.max(...pts.map((p) => p.volume)) || 1
        projected.forEach((p) => {
          const barH = (p.volume / maxVol) * (height * 0.15)
          const isUp = p.close >= p.open
          ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)'
          ctx.fillRect(p.px - 3, height - barH - 20, 6, barH)
        })

        // Draw Candlesticks along projected coordinates
        projected.forEach((p) => {
          const isUp = p.close >= p.open
          const openY = paddingY + chartH - ((p.open - minVal) / valRange) * chartH
          const closeY = paddingY + chartH - ((p.close - minVal) / valRange) * chartH
          const highY = paddingY + chartH - ((p.high - minVal) / valRange) * chartH
          const lowY = paddingY + chartH - ((p.low - minVal) / valRange) * chartH

          // Wick
          ctx.strokeStyle = isUp ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 68, 68, 0.55)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(p.px, highY)
          ctx.lineTo(p.px, lowY)
          ctx.stroke()

          // Body
          ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.75)' : 'rgba(239, 68, 68, 0.75)'
          const bodyH = Math.max(Math.abs(closeY - openY), 2)
          ctx.fillRect(p.px - 2.5, Math.min(openY, closeY), 5, bodyH)
        })

        // Draw Neon Spline Curve
        ctx.beginPath()
        ctx.moveTo(projected[0].px, projected[0].py)

        for (let i = 0; i < projected.length - 1; i++) {
          const curr = projected[i]
          const next = projected[i + 1]
          const mx = (curr.px + next.px) / 2
          const my = (curr.py + next.py) / 2
          ctx.quadraticCurveTo(curr.px, curr.py, mx, my)
        }
        const lastPt = projected[projected.length - 1]
        ctx.lineTo(lastPt.px, lastPt.py)

        // Neon Glow Outline
        ctx.save()
        ctx.shadowColor = '#10b981'
        ctx.shadowBlur = 14
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.restore()

        // Gradient Area Fill
        ctx.lineTo(lastPt.px, height - 20)
        ctx.lineTo(projected[0].px, height - 20)
        ctx.closePath()

        const grad = ctx.createLinearGradient(0, paddingY, 0, height)
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.24)')
        grad.addColorStop(0.55, 'rgba(16, 185, 129, 0.05)')
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)')
        ctx.fillStyle = grad
        ctx.fill()

        // Real-Time Crosshairs following mouse
        if (mouse.active && mouse.x >= 0 && mouse.y >= 0) {
          ctx.save()
          ctx.setLineDash([4, 4])
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)'
          ctx.lineWidth = 1.2

          // Vertical line
          ctx.beginPath()
          ctx.moveTo(mouse.x, 0)
          ctx.lineTo(mouse.x, height)
          ctx.stroke()

          // Horizontal line
          ctx.beginPath()
          ctx.moveTo(0, mouse.y)
          ctx.lineTo(width, mouse.y)
          ctx.stroke()

          // Pinned badge on Right Price Axis
          const sym = activeAssetRef.current === 'NVDA' ? '$' : '₹'
          const axisYVal = maxVal - ((mouse.y - paddingY) / chartH) * valRange
          const clampedVal = Math.max(minVal, Math.min(maxVal, axisYVal))
          ctx.fillStyle = '#0284c7'
          ctx.fillRect(width - 70, mouse.y - 10, 65, 20)
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 10px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`${sym}${clampedVal.toFixed(1)}`, width - 37, mouse.y + 4)

          // Glowing intersection dot
          ctx.setLineDash([])
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 15
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(mouse.x, mouse.y, 4.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // Update & Render Particles
      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]
        pt.x += pt.vx
        pt.y += pt.vy
        pt.alpha -= 0.016
        if (pt.alpha <= 0) {
          particles.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = Math.max(pt.alpha, 0)
        ctx.fillStyle = pt.color
        ctx.shadowColor = pt.color
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Update & Render Click Ripples
      const ripples = ripplesRef.current
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.radius += 2.2
        r.alpha -= 0.018
        r.y -= 0.5

        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = Math.max(r.alpha, 0)
        ctx.strokeStyle = r.isBuy ? '#10b981' : '#f43f5e'
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
        ctx.stroke()

        // Floating trade badge
        ctx.fillStyle = r.isBuy ? '#10b981' : '#f43f5e'
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(r.text, r.x, r.y - r.radius - 6)
        ctx.restore()
      }

      animFrameId.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
    }
  }, [])

  // Mouse Move Handler: Updates refs & direct DOM only (Zero React Re-renders!)
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    mousePosRef.current = { x, y, active: true }

    // Spawn subtle particle sparks
    if (Math.random() < 0.5) {
      const colors = ['#38bdf8', '#10b981', '#34d399', '#60a5fa']
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - 0.5,
        alpha: 1,
        size: Math.random() * 2.5 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
      if (particlesRef.current.length > 45) particlesRef.current.shift()
    }

    // Direct DOM price text update without triggering React component re-render
    const chartW = rect.width - 80
    const relX = Math.max(0, Math.min(x - 40, chartW))
    const ratio = chartW > 0 ? relX / chartW : 0
    const pts = pointsRef.current
    if (pts.length > 0) {
      const idx = Math.min(Math.floor(ratio * pts.length), pts.length - 1)
      const pt = pts[idx]
      if (pt) {
        currentPriceRef.current = pt.close
        updatePriceDOM(pt.close, pt.time)
      }
    }
  }

  function handleMouseLeave() {
    mousePosRef.current.active = false
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const isBuy = Math.random() > 0.4
    const sym = activeAssetRef.current === 'NVDA' ? '$' : '₹'
    const text = isBuy
      ? `▲ BUY 100 @ ${sym}${currentPriceRef.current.toFixed(2)}`
      : `▼ SELL 50 @ ${sym}${currentPriceRef.current.toFixed(2)}`

    ripplesRef.current.push({
      x,
      y,
      radius: 5,
      maxRadius: 45,
      alpha: 1,
      text,
      isBuy,
    })
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative w-full h-full min-h-screen flex flex-col justify-between p-6 overflow-hidden bg-gradient-to-br from-gray-950 via-slate-950 to-gray-950 select-none cursor-crosshair group"
    >
      {/* ── TOP HUD RIBBON ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-gray-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-gray-800/90 shadow-lg">
        {/* Asset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Asset:</span>
          <button
            ref={assetBtnNiftyRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setAsset('NIFTY')
            }}
            className="text-xs px-3 py-1 rounded-lg font-bold bg-blue-600 text-white shadow-md shadow-blue-500/30 transition-all"
          >
            NIFTY 50
          </button>
          <button
            ref={assetBtnRelRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setAsset('RELIANCE')
            }}
            className="text-xs px-3 py-1 rounded-lg font-bold bg-gray-800/80 text-gray-400 hover:text-white transition-all"
          >
            RELIANCE
          </button>
          <button
            ref={assetBtnNvdaRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setAsset('NVDA')
            }}
            className="text-xs px-3 py-1 rounded-lg font-bold bg-gray-800/80 text-gray-400 hover:text-white transition-all"
          >
            NVDA (US)
          </button>
        </div>

        {/* Live Hover Statistics (Direct DOM updated) */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-gray-400 font-medium">Index:</span>
            <span
              ref={priceDisplayRef}
              className="text-lg font-extrabold text-white tracking-tight font-mono"
            >
              ₹24,360.50
            </span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-bold">
            <span>▲ +1.42%</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-gray-400">
            <span className="text-gray-500">Time:</span>
            <span ref={timeDisplayRef} className="font-mono text-gray-200">
              15:30
            </span>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE CANVAS VIEW (FULL-SCREEN LEFT SIDE) ── */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* ── FLOATING MARKET TICKER CARDS (PARALLAX TILES) ── */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 my-auto pointer-events-none opacity-85">
        <div className="bg-gray-900/60 backdrop-blur-md p-3.5 rounded-xl border border-gray-800 shadow-lg transform transition-transform group-hover:scale-[1.02]">
          <div className="text-[11px] text-gray-400 font-medium">NIFTY 50</div>
          <div className="text-sm font-bold text-white mt-0.5">24,360.50</div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +1.42% (+340 pts)</div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md p-3.5 rounded-xl border border-gray-800 shadow-lg transform transition-transform group-hover:scale-[1.02]">
          <div className="text-[11px] text-gray-400 font-medium">SENSEX</div>
          <div className="text-sm font-bold text-white mt-0.5">79,840.10</div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +1.18% (+930 pts)</div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md p-3.5 rounded-xl border border-gray-800 shadow-lg transform transition-transform group-hover:scale-[1.02]">
          <div className="text-[11px] text-gray-400 font-medium">NASDAQ 100</div>
          <div className="text-sm font-bold text-white mt-0.5">18,290.40</div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +0.95% (+172 pts)</div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md p-3.5 rounded-xl border border-gray-800 shadow-lg transform transition-transform group-hover:scale-[1.02]">
          <div className="text-[11px] text-gray-400 font-medium">RELIANCE (NSE)</div>
          <div className="text-sm font-bold text-white mt-0.5">₹1,339.70</div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +14.8% (Bullish)</div>
        </div>
      </div>

      {/* ── BOTTOM TERMINAL FOOTER ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-gray-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-gray-800 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-gray-300 font-medium">Hardware Accelerated Stock Canvas</span>
          <span className="text-gray-500 hidden md:inline">
            · Real-time mouse tracking · Zero React re-renders · Click anywhere to test trade impulses
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span>
            Vol: <strong className="text-gray-200">14.8M</strong>
          </span>
          <span className="text-emerald-400 font-semibold">● Live Session Active</span>
        </div>
      </div>
    </div>
  )
}
