export type Market = 'NSE' | 'BSE' | 'US'

export interface StockMover {
  ticker: string
  name: string
  market: Market
  current_price?: number
  currency?: string
  change?: number
  change_pct?: number
  signal?: string
  category: 'bullish' | 'bearish'
}

export interface MarketMoversResponse {
  bullish: StockMover[]
  bearish: StockMover[]
  last_updated?: string
}

export interface StockInfo {
  ticker: string
  name?: string
  market: Market
  currency?: string
  sector?: string
  industry?: string
  current_price?: number
  market_cap?: number
  pe_ratio?: number
  pb_ratio?: number
  roe?: number
  revenue?: number
  net_income?: number
  total_debt?: number
  cash?: number
  '52w_high'?: number
  '52w_low'?: number
  dividend_yield?: number
  beta?: number
  summary?: string
  error?: string
}

export interface OHLCVPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ResearchTask {
  task_id: string
  ticker: string
  market: Market
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
}

export interface AgentResult {
  result_id: string
  agent_name: string
  status: string
  output_json?: Record<string, unknown>
  error_message?: string
  created_at: string
}

export interface ResearchReport {
  report_id: string
  task_id: string
  report_content?: string
  summary?: string
  limitations?: string
  created_at: string
}

export interface FullResearch {
  task: ResearchTask
  agent_results: AgentResult[]
  report?: ResearchReport
}

export interface User {
  user_id: string
  email: string
  created_at: string
}
