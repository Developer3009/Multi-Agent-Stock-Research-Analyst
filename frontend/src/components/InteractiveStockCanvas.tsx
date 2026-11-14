import React, { useEffect, useRef, useState } from 'react'

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
  const [mousePos, setMousePos] = useState<{ x: number; y: number; active: boolean }>({
    x: -100,
    y: -100,
    active: false,
  })
  const [currentHoverPrice, setCurrentHoverPrice] = useState<number>(2540.8)
  const [currentHoverTime, setCurrentHoverTime] = useState<string>('14:30')
  const [activeAsset, setActiveAsset] = useState<'NIFTY' | 'RELIANCE' | 'NVDA'>('NIFTY')

  // Generate synthetic base series for the canvas
  const pointsRef = useRef<Point[]>([])
  const particlesRef = useRef<Particle[]>([])
  const ripplesRef = useRef<TradeRipple[]>([])
  const animFrameId = useRef<number | null>(null)
  const timeOffsetRef = useRef<number>(0)

  // Initialize synthetic dataset
  useEffect(() => {
    const pts: Point[] = []
    let basePrice = activeAsset === 'NVDA' ? 145 : activeAsset === 'RELIANCE' ? 1280 : 24150
    const count = 48

    for (let i = 0; i < count; i++) {
      const delta = (Math.sin(i * 0.25) * 0.6 + (Math.random() - 0.48) * 0.8) * (basePrice * 0.004)
      const open = basePrice
      const close = basePrice + delta
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.002)
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.002)
      const volume = Math.floor(Math.random() * 50000) + 10000

      const hour = 9 + Math.floor(i / 8)
      const min = (i % 8) * 7.5
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
  }, [activeAsset])

  useEffect(() => {
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
      timeOffsetRef.current += 0.02
      ctx.clearRect(0, 0, width, height)

      // Background subtle financial grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)'
      ctx.lineWidth = 1
      const xStep = width / 8
      const yStep = height / 6

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
      if (pts.length > 1) {
        const minVal = Math.min(...pts.map((p) => p.low)) * 0.998
        const maxVal = Math.max(...pts.map((p) => p.high)) * 1.002
        const valRange = maxVal - minVal || 1

        const paddingX = 40
        const paddingY = 60
        const chartW = width - paddingX * 2
        const chartH = height - paddingY * 2

        // Project points to canvas coordinates
        const projected = pts.map((p, idx) => {
          const px = paddingX + (idx / (pts.length - 1)) * chartW
          // Calculate elastic attraction to mouse
          let yVal = p.close
          if (mousePos.active) {
            const dist = Math.abs(px - mousePos.x)
            if (dist < 120) {
              const influence = (1 - dist / 120) * 8
              yVal += (mousePos.y < height / 2 ? 1 : -1) * influence
            }
          }
          const py = paddingY + chartH - ((yVal - minVal) / valRange) * chartH
          return { ...p, px, py }
        })

        // Draw Volume Bars at bottom
        const maxVol = Math.max(...pts.map((p) => p.volume)) || 1
        projected.forEach((p) => {
          const barH = (p.volume / maxVol) * (height * 0.16)
          const isUp = p.close >= p.open
          ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)'
          ctx.fillRect(p.px - 3, height - barH - 10, 6, barH)
        })

        // Draw Candlesticks along projected coordinates
        projected.forEach((p) => {
          const isUp = p.close >= p.open
          const openY = paddingY + chartH - ((p.open - minVal) / valRange) * chartH
          const closeY = paddingY + chartH - ((p.close - minVal) / valRange) * chartH
          const highY = paddingY + chartH - ((p.high - minVal) / valRange) * chartH
          const lowY = paddingY + chartH - ((p.low - minVal) / valRange) * chartH

          // Wick
          ctx.strokeStyle = isUp ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(p.px, highY)
          ctx.lineTo(p.px, lowY)
          ctx.stroke()

          // Body
          ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
          const bodyH = Math.max(Math.abs(closeY - openY), 2)
          ctx.fillRect(p.px - 2.5, Math.min(openY, closeY), 5, bodyH)
        })

        // Draw Neon Spline Line & Gradient Area
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

        // Stroke neon glow
        ctx.save()
        ctx.shadowColor = '#10b981'
        ctx.shadowBlur = 12
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.restore()

        // Gradient Fill underneath
        ctx.lineTo(lastPt.px, height - 10)
        ctx.lineTo(projected[0].px, height - 10)
        ctx.closePath()

        const grad = ctx.createLinearGradient(0, paddingY, 0, height)
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.22)')
        grad.addColorStop(0.6, 'rgba(16, 185, 129, 0.04)')
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)')
        ctx.fillStyle = grad
        ctx.fill()

        // Active Crosshairs tracking mouse
        if (mousePos.active && mousePos.x >= 0 && mousePos.y >= 0) {
          ctx.save()
          ctx.setLineDash([4, 4])
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'
          ctx.lineWidth = 1.2

          // Vertical line
          ctx.beginPath()
          ctx.moveTo(mousePos.x, 0)
          ctx.lineTo(mousePos.x, height)
          ctx.stroke()

          // Horizontal line
          ctx.beginPath()
          ctx.moveTo(0, mousePos.y)
          ctx.lineTo(width, mousePos.y)
          ctx.stroke()

          // Pulsing node at mouse intersection
          ctx.setLineDash([])
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 15
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(mousePos.x, mousePos.y, 4.5, 0, Math.PI * 2)
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
        pt.alpha -= 0.015
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
  }, [mousePos, activeAsset])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMousePos({ x, y, active: true })

    // Spawn subtle particle sparks along mouse movement
    if (Math.random() < 0.6) {
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
      if (particlesRef.current.length > 50) particlesRef.current.shift()
    }

    // Calculate hover price and time
    const chartW = rect.width - 80
    const relX = Math.max(0, Math.min(x - 40, chartW))
    const ratio = chartW > 0 ? relX / chartW : 0
    const pts = pointsRef.current
    if (pts.length > 0) {
      const idx = Math.min(Math.floor(ratio * pts.length), pts.length - 1)
      const pt = pts[idx]
      if (pt) {
        setCurrentHoverPrice(pt.close)
        setCurrentHoverTime(pt.time)
      }
    }
  }

  function handleMouseLeave() {
    setMousePos((prev) => ({ ...prev, active: false }))
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const isBuy = Math.random() > 0.4
    const sym = activeAsset === 'NVDA' ? '$' : '₹'
    const text = isBuy
      ? `▲ BUY 100 @ ${sym}${currentHoverPrice.toFixed(2)}`
      : `▼ SELL 50 @ ${sym}${currentHoverPrice.toFixed(2)}`

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

  const currencySymbol = activeAsset === 'NVDA' ? '$' : '₹'

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative w-full h-full min-h-[500px] flex flex-col justify-between p-6 overflow-hidden rounded-2xl bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 border border-gray-800/80 shadow-2xl select-none cursor-crosshair group"
    >
      {/* ── TOP HUD RIBBON ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-gray-900/80 backdrop-blur-md px-4 py-3 rounded-xl border border-gray-800/90 shadow-lg">
        {/* Asset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Asset:</span>
          {(['NIFTY', 'RELIANCE', 'NVDA'] as const).map((ast) => (
            <button
              key={ast}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveAsset(ast)
              }}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                activeAsset === ast
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-gray-800/80 text-gray-400 hover:text-white'
              }`}
            >
              {ast}
            </button>
          ))}
        </div>

        {/* Live Hover Statistics */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-gray-400 font-medium">Index:</span>
            <span className="text-lg font-extrabold text-white tracking-tight">
              {currencySymbol}{currentHoverPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-bold">
            <span>▲ +1.64%</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-gray-400">
            <span className="text-gray-500">Time:</span>
            <span className="font-mono text-gray-200">{currentHoverTime}</span>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE CANVAS VIEW ── */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* ── FLOATING MARKET TICKER CARDS (PARALLAX ON MOUSE) ── */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 my-auto pointer-events-none opacity-85">
        <div className="bg-gray-900/60 backdrop-blur-md p-3 rounded-xl border border-gray-800 shadow-lg transform transition-transform group-hover:scale-[1.02]">
          <div className="text-[11px] text-gray-400 font-medium">NIFTY 50</div>
          <div className="text-sm font-bold text-white mt-0.5">24,360.50</div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +1.42% (+340 pts)</div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md p-3 rounded-xl border border-gray-800 shadow-lg transform transition-transform group-hover:scale-[1.02]">
          <div className="text-[11px] text-gray-400 font-medium">SENSEX</div>
          <div className="text-sm font-bold text-white mt-0.5">79,840.10</div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +1.18% (+930 pts)</div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md p-3 rounded-xl border border-gray-800 shadow-lg transform transition-transform group-hover:scale-[1.02]">
          <div className="text-[11px] text-gray-400 font-medium">NASDAQ 100</div>
          <div className="text-sm font-bold text-white mt-0.5">18,290.40</div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +0.95% (+172 pts)</div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md p-3 rounded-xl border border-gray-800 shadow-lg transform transition-transform group-hover:scale-[1.02]">
          <div className="text-[11px] text-gray-400 font-medium">RELIANCE (NSE)</div>
          <div className="text-sm font-bold text-white mt-0.5">₹1,339.70</div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +14.8% (Bullish)</div>
        </div>
      </div>

      {/* ── BOTTOM TERMINAL FOOTER ── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-gray-900/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-gray-800 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-gray-300 font-medium">Live Interactive Canvas</span>
          <span className="text-gray-500 hidden md:inline">· Move mouse to scrub price, inspect order flow, or click to test trade impulses</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span>Vol: <strong className="text-gray-200">14.8M</strong></span>
          <span>VWAP: <strong className="text-cyan-400">{currencySymbol}{(currentHoverPrice * 0.994).toFixed(2)}</strong></span>
          <span className="text-emerald-400 font-semibold">● Real-Time Feed</span>
        </div>
      </div>
    </div>
  )
}
