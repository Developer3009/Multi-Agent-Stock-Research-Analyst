import React from 'react'
import clsx from 'clsx'
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import type { AgentResult } from '../types'

interface Props {
  agentName: string
  result?: AgentResult
  running?: boolean
}

const AGENT_LABELS: Record<string, string> = {
  fundamental: '📊 Fundamental Analysis',
  technical: '📈 Technical Analysis',
  news: '📰 News & Sentiment',
  risk: '⚠️ Risk Analysis',
}

export default function AgentStatusCard({ agentName, result, running }: Props) {
  const label = AGENT_LABELS[agentName] || agentName
  const status = result?.status ?? (running ? 'running' : 'pending')

  return (
    <div
      className={clsx(
        'card flex items-start gap-3 transition-all',
        status === 'completed' && 'border-green-800/50',
        status === 'failed' && 'border-red-800/50',
        status === 'running' && 'border-blue-800/50 animate-pulse',
        status === 'unavailable' && 'border-yellow-800/50'
      )}
    >
      <StatusIcon status={status} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5 capitalize">{status}</p>
        {result?.error_message && (
          <p className="text-xs text-red-400 mt-1 truncate">{result.error_message}</p>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
    case 'running':
      return <Loader2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5 animate-spin" />
    case 'unavailable':
      return <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
    default:
      return <Clock className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
  }
}
