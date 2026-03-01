'use client'

import { useState } from 'react'
import { useUpload } from './upload-context'
import { Loader2, ChevronDown, ChevronUp, X, CheckCircle2, AlertTriangle } from 'lucide-react'

export function UploadOverlay() {
  const { jobs, resolveConflict, dismissJob } = useUpload()
  const [collapsed, setCollapsed] = useState(false)

  if (jobs.length === 0) return null

  const activeCount = jobs.filter(j => j.status !== 'done').length
  const allDone = activeCount === 0
  const doneFraction = (job: typeof jobs[number]) =>
    (job.successCount + job.skipCount + job.errorCount) / job.totalFiles

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl shadow-2xl bg-gray-900 border border-gray-700 overflow-hidden">

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-gray-800 border-b border-gray-700"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          {allDone
            ? <CheckCircle2 size={15} className="text-green-400" />
            : <Loader2 size={15} className="animate-spin text-blue-400" />
          }
          <span className="text-sm font-medium text-white">
            {allDone ? 'Uploads complete' : `Uploading (${activeCount})…`}
          </span>
        </div>
        {collapsed
          ? <ChevronUp size={15} className="text-gray-400" />
          : <ChevronDown size={15} className="text-gray-400" />
        }
      </div>

      {/* ─── Job list ───────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-800">
          {jobs.map(job => (
            <div key={job.id} className="px-4 py-3 space-y-2">

              {/* Job label row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate">{job.projectName} / {job.folderLabel}</p>
                  <p className="text-sm text-white font-medium truncate">
                    {job.uploadedFolderName ? `📁 ${job.uploadedFolderName}` : `${job.totalFiles} file${job.totalFiles !== 1 ? 's' : ''}`}
                  </p>
                </div>
                {job.status === 'done' && (
                  <button
                    onClick={() => dismissJob(job.id)}
                    className="text-gray-500 hover:text-white flex-shrink-0 mt-0.5 transition-colors"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Progress bar (shown when not in conflict state) */}
              {job.status !== 'conflict' && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="truncate max-w-[180px]">
                      {job.status === 'done' ? 'Done' : job.currentFileName}
                    </span>
                    <span className="flex-shrink-0 tabular-nums">
                      {job.status === 'done'
                        ? `${job.totalFiles}/${job.totalFiles}`
                        : `${job.currentIndex + 1}/${job.totalFiles}`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${
                        job.status === 'done' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{
                        width: job.status === 'done'
                          ? '100%'
                          : `${Math.max(4, doneFraction(job) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Conflict resolution — inline buttons, no dialog */}
              {job.status === 'conflict' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-yellow-400">
                    <AlertTriangle size={13} className="flex-shrink-0" />
                    <span className="text-xs truncate">"{job.conflictFileName}" already exists</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => resolveConflict(job.id, 'overwrite')}
                      className="flex-1 text-xs px-2 py-1.5 rounded bg-red-900/40 hover:bg-red-900/60 border border-red-700/40 text-red-300 transition-colors"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => resolveConflict(job.id, 'rename')}
                      className="flex-1 text-xs px-2 py-1.5 rounded bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/40 text-blue-300 transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => resolveConflict(job.id, 'skip')}
                      className="flex-1 text-xs px-2 py-1.5 rounded bg-gray-700/60 hover:bg-gray-700 border border-gray-600 text-gray-400 transition-colors"
                      title="Skip all duplicate files in this upload"
                    >
                      Skip All
                    </button>
                  </div>
                </div>
              )}

              {/* Done summary */}
              {job.status === 'done' && (
                <p className="text-xs text-gray-500">
                  {[
                    job.successCount > 0 && `${job.successCount} uploaded`,
                    job.skipCount > 0 && `${job.skipCount} skipped`,
                    job.errorCount > 0 && `${job.errorCount} failed`,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}

            </div>
          ))}
        </div>
      )}

    </div>
  )
}
