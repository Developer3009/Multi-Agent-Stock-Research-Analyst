import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { researchAPI } from '../api/client'
import type { ResearchTask } from '../types'
import { Clock, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'

export default function History() {
  const [tasks, setTasks] = useState<ResearchTask[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    researchAPI
      .history()
      .then((res) => setTasks(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Research History</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card text-center py-16">
          <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">No research history yet</p>
          <p className="text-sm text-gray-600 mt-1">Start your first research from the dashboard</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.task_id}
              className="card flex items-center justify-between cursor-pointer hover:border-gray-600 transition-all"
              onClick={() => navigate(`/?task=${task.task_id}`)}
            >
              <div className="flex items-center gap-3">
                <StatusIcon status={task.status} />
                <div>
                  <span className="font-semibold">{task.ticker}</span>
                  <span className={clsx(
                    'ml-2 text-xs px-2 py-0.5 rounded-full',
                    task.market === 'NSE' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                  )}>{task.market}</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(task.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <span className={clsx(
                'text-xs capitalize font-semibold px-2 py-1 rounded',
                task.status === 'completed' && 'text-green-400',
                task.status === 'failed' && 'text-red-400',
                task.status === 'running' && 'text-blue-400',
                task.status === 'pending' && 'text-gray-400',
              )}>
                {task.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle className="w-5 h-5 text-green-500" />
  if (status === 'failed') return <XCircle className="w-5 h-5 text-red-500" />
  if (status === 'running') return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
  return <Clock className="w-5 h-5 text-gray-500" />
}
