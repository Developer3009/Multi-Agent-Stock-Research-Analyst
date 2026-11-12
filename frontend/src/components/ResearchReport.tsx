import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { ResearchReport as ReportType } from '../types'
import { Download } from 'lucide-react'

interface Props {
  report: ReportType
}

export default function ResearchReport({ report }: Props) {
  function handleDownload() {
    const blob = new Blob([report.report_content || ''], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-report-${report.task_id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">📄 Research Report</h2>
        <button onClick={handleDownload} className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" />
          Download MD
        </button>
      </div>

      {report.summary && (
        <div className="bg-blue-950/40 border border-blue-800/40 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-blue-300 mb-1">Summary</p>
          <p className="text-sm text-gray-300">{report.summary}</p>
        </div>
      )}

      <div className="prose prose-invert prose-sm max-w-none
        prose-headings:text-gray-100
        prose-p:text-gray-300
        prose-strong:text-white
        prose-code:text-blue-300
        prose-ul:text-gray-300
        prose-li:marker:text-gray-500
      ">
        <ReactMarkdown>{report.report_content || '_No report content available._'}</ReactMarkdown>
      </div>

      {report.limitations && (
        <div className="mt-4 bg-yellow-950/30 border border-yellow-800/30 rounded-lg p-3">
          <p className="text-xs font-semibold text-yellow-400 mb-1">Data Limitations</p>
          <p className="text-xs text-gray-400 whitespace-pre-line">{report.limitations}</p>
        </div>
      )}
    </div>
  )
}
