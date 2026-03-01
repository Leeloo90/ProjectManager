'use client'

import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo, startTransition } from 'react'

export type ConflictResolution = 'overwrite' | 'rename' | 'skip'

export type UploadJob = {
  id: string
  projectName: string
  folderLabel: string
  folderId: string
  files: File[]
  isFolderUpload: boolean
  totalFiles: number
  currentIndex: number
  currentFileName: string
  successCount: number
  skipCount: number
  errorCount: number
  status: 'uploading' | 'conflict' | 'done' | 'paused' | 'queued' | 'checking' | 'needs-resolution'
  conflictFileName?: string
  conflictingFiles: string[]
  uploadedFolderName?: string
}

type AddJobParams = {
  files: File[]
  folderId: string
  folderLabel: string
  projectName: string
  isFolderUpload?: boolean
  onComplete?: (successCount: number, skipCount: number, errorCount: number) => void
}

type UploadActions = {
  addJob: (params: AddJobParams) => void
  resolveConflict: (jobId: string, resolution: ConflictResolution) => void
  resolveJobConflicts: (jobId: string, resolution: ConflictResolution) => void
  dismissJob: (jobId: string) => void
  pauseJob: (jobId: string) => void
  resumeJob: (jobId: string) => void
}

// Split into two contexts so components that only need actions don't re-render on every upload tick
const UploadJobsContext = createContext<UploadJob[]>([])
const UploadActionsContext = createContext<UploadActions | null>(null)

export function useUploadActions(): UploadActions {
  const ctx = useContext(UploadActionsContext)
  if (!ctx) throw new Error('useUploadActions must be used inside UploadProvider')
  return ctx
}

export function useUpload() {
  return { jobs: useContext(UploadJobsContext), ...useUploadActions() }
}

async function uploadFile(
  file: File,
  folderId: string,
  signal: AbortSignal,
  conflictResolution?: ConflictResolution,
): Promise<{ status: 'success' | 'skip' | 'error' | 'conflict'; existingFileName?: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folderId', folderId)
  formData.append('filename', file.name)
  if (conflictResolution) formData.append('conflictResolution', conflictResolution)

  try {
    const res = await fetch('/api/drive/upload', { method: 'POST', body: formData, signal })
    const data = await res.json()
    if (!res.ok) return { status: 'error' }
    if (data.conflict) return { status: 'conflict', existingFileName: data.existingFileName }
    if (data.skipped) return { status: 'skip' }
    return { status: 'success' }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err 
    }
    return { status: 'error' }
  }
}

async function resolveFolderPath(
  segments: string[],
  rootFolderId: string,
  folderCache: Map<string, string>,
): Promise<string> {
  let parentId = rootFolderId
  for (let i = 0; i < segments.length; i++) {
    const pathKey = segments.slice(0, i + 1).join('/')
    if (!folderCache.has(pathKey)) {
      const res = await fetch('/api/drive/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segments[i], parentId }),
      })
      const data = await res.json()
      if (!data.folderId) throw new Error(`Failed to create folder: ${segments[i]}`)
      folderCache.set(pathKey, data.folderId)
    }
    parentId = folderCache.get(pathKey)!
  }
  return parentId
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const activeUploads = useRef(new Set<string>())
  const abortControllers = useRef(new Map<string, AbortController>())
  
  const resolversRef = useRef<Map<string, (resolution: ConflictResolution) => void>>(new Map())
  const preResolversRef = useRef<Map<string, (resolution: ConflictResolution) => void>>(new Map())
  const autoSkipRef = useRef<Set<string>>(new Set())
  const onCompleteCallbacks = useRef<Map<string, (s: number, sk: number, e: number) => void>>(new Map())

  const startUpload = useCallback(async (job: UploadJob) => {
    if (activeUploads.current.has(job.id)) return
    activeUploads.current.add(job.id)

    // ─── Pre-scan for conflicts (flat uploads only) ──────────────────────────
    // These are urgent — they need to show UI immediately
    let preResolution: ConflictResolution | null = null
    if (!job.isFolderUpload) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'checking' } : j))
      try {
        const res = await fetch(`/api/drive/files?folderId=${job.folderId}`)
        if (res.ok) {
          const existingFiles: { name: string; mimeType: string }[] = await res.json()
          const existingNames = new Set(
            existingFiles
              .filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
              .map(f => f.name)
          )
          const conflicting = job.files.map(f => f.name).filter(name => existingNames.has(name))
          if (conflicting.length > 0) {
            setJobs(prev => prev.map(j => j.id === job.id
              ? { ...j, status: 'needs-resolution', conflictingFiles: conflicting }
              : j
            ))
            preResolution = await new Promise<ConflictResolution>(resolve =>
              preResolversRef.current.set(job.id, resolve)
            )
            preResolversRef.current.delete(job.id)
            if (!activeUploads.current.has(job.id)) return
          }
        }
      } catch {
        // Pre-scan failed — per-file conflict handling will cover it
      }
    }

    const folderCache = new Map<string, string>()
    // Track counts locally so the onComplete callback doesn't depend on React flushing state
    let successCount = 0, skipCount = 0, errorCount = 0

    for (let i = job.currentIndex; i < job.files.length; i++) {
      const controller = new AbortController()
      abortControllers.current.set(job.id, controller)

      const file = job.files[i]
      // Progress update — non-urgent, defer so user interactions aren't blocked
      const idx = i, fileName = file.name
      startTransition(() => {
        setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, currentIndex: idx, currentFileName: fileName, status: 'uploading' } : j)))
      })

      let targetFolderId = job.folderId
      if (job.isFolderUpload && file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/')
        const dirParts = parts.slice(0, -1)
        if (dirParts.length > 0) {
          try {
            targetFolderId = await resolveFolderPath(dirParts, job.folderId, folderCache)
          } catch {
            errorCount++
            const ec = errorCount
            startTransition(() => {
              setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, errorCount: ec } : j)))
            })
            continue
          }
        }
      }

      try {
        const result = await uploadFile(file, targetFolderId, controller.signal, preResolution ?? undefined)

        if (result.status === 'conflict') {
          if (autoSkipRef.current.has(job.id)) {
            skipCount++
            const sc = skipCount
            startTransition(() => {
              setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, skipCount: sc } : j)))
            })
            continue
          }

          // Conflict UI — urgent, show immediately
          setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, status: 'conflict', conflictFileName: file.name } : j)))
          const resolution = await new Promise<ConflictResolution>(resolve => resolversRef.current.set(job.id, resolve))
          resolversRef.current.delete(job.id)

          if (resolution === 'skip') {
            autoSkipRef.current.add(job.id)
            skipCount++
            const sc = skipCount
            startTransition(() => {
              setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, skipCount: sc } : j)))
            })
            continue
          }

          const retryController = new AbortController()
          abortControllers.current.set(job.id, retryController)
          const retryResult = await uploadFile(file, targetFolderId, retryController.signal, resolution)
          if (retryResult.status === 'success') successCount++; else errorCount++
          const sc2 = successCount, ec2 = errorCount
          startTransition(() => {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, successCount: sc2, errorCount: ec2 } : j))
          })
        } else if (result.status === 'success') {
          successCount++
          const sc = successCount
          startTransition(() => {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, successCount: sc } : j))
          })
        } else if (result.status === 'skip') {
          skipCount++
          const sk = skipCount
          startTransition(() => {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, skipCount: sk } : j))
          })
        } else {
          errorCount++
          const ec = errorCount
          startTransition(() => {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, errorCount: ec } : j))
          })
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Pause state — urgent
          setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, status: 'paused', currentIndex: i } : j)))
          activeUploads.current.delete(job.id)
          return
        }
      }
    }

    autoSkipRef.current.delete(job.id)
    abortControllers.current.delete(job.id)
    // Fire callback immediately with local counts — don't wait for React to flush
    onCompleteCallbacks.current.get(job.id)?.(successCount, skipCount, errorCount)
    onCompleteCallbacks.current.delete(job.id)
    activeUploads.current.delete(job.id)
    // Done state — set counts explicitly from local vars so order doesn't matter
    startTransition(() => {
      setJobs(prev => prev.map(j => j.id === job.id
        ? { ...j, status: 'done' as const, currentIndex: j.totalFiles, successCount, skipCount, errorCount }
        : j
      ))
    })
  }, [])

  useEffect(() => {
    const nextJob = jobs.find(j => j.status === 'queued')
    if (nextJob) {
      startUpload(nextJob)
    }
  }, [jobs, startUpload])

  const addJob = useCallback((params: AddJobParams) => {
    const jobId = crypto.randomUUID()
    const { files, isFolderUpload = false, onComplete } = params
    const uploadedFolderName = isFolderUpload ? files[0]?.webkitRelativePath?.split('/')[0] ?? 'Folder' : undefined

    if (onComplete) onCompleteCallbacks.current.set(jobId, onComplete)

    const newJob: UploadJob = {
      ...params,
      id: jobId,
      isFolderUpload,
      totalFiles: files.length,
      currentIndex: 0,
      currentFileName: files[0]?.name ?? '',
      successCount: 0,
      skipCount: 0,
      errorCount: 0,
      status: 'queued',
      conflictingFiles: [],
      uploadedFolderName,
    }
    setJobs(prev => [...prev, newJob])
  }, [])
  
  const pauseJob = useCallback((jobId: string) => {
    abortControllers.current.get(jobId)?.abort()
  }, [])

  const resumeJob = useCallback((jobId: string) => {
    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'queued' } : j)))
  }, [])

  const resolveConflict = useCallback((jobId: string, resolution: ConflictResolution) => {
    resolversRef.current.get(jobId)?.(resolution)
  }, [])

  const resolveJobConflicts = useCallback((jobId: string, resolution: ConflictResolution) => {
    preResolversRef.current.get(jobId)?.(resolution)
  }, [])

  const dismissJob = useCallback((jobId: string) => {
    abortControllers.current.get(jobId)?.abort()
    preResolversRef.current.get(jobId)?.('skip') // unblock any pending pre-scan promise
    preResolversRef.current.delete(jobId)
    autoSkipRef.current.delete(jobId)
    onCompleteCallbacks.current.delete(jobId)
    activeUploads.current.delete(jobId)
    setJobs(prev => prev.filter(j => j.id !== jobId))
  }, [])

  const actions = useMemo<UploadActions>(
    () => ({ addJob, resolveConflict, resolveJobConflicts, dismissJob, pauseJob, resumeJob }),
    [addJob, resolveConflict, resolveJobConflicts, dismissJob, pauseJob, resumeJob]
  )

  return (
    <UploadJobsContext.Provider value={jobs}>
      <UploadActionsContext.Provider value={actions}>
        {children}
      </UploadActionsContext.Provider>
    </UploadJobsContext.Provider>
  )
}

