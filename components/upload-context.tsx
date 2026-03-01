'use client'

import { createContext, useContext, useState, useRef, useCallback } from 'react'

export type ConflictResolution = 'overwrite' | 'rename' | 'skip'

export type UploadJob = {
  id: string
  projectName: string
  folderLabel: string       // Target Drive subfolder (e.g. "Proxy Footage")
  folderId: string
  totalFiles: number
  currentIndex: number      // 0-based index of file currently being uploaded
  currentFileName: string
  successCount: number
  skipCount: number
  errorCount: number
  status: 'uploading' | 'conflict' | 'done'
  conflictFileName?: string
  uploadedFolderName?: string  // Set for folder uploads (the local folder name)
}

type AddJobParams = {
  files: File[]
  folderId: string
  folderLabel: string
  projectName: string
  isFolderUpload?: boolean  // When true, files have webkitRelativePath set
}

type UploadContextValue = {
  jobs: UploadJob[]
  addJob: (params: AddJobParams) => void
  resolveConflict: (jobId: string, resolution: ConflictResolution) => void
  dismissJob: (jobId: string) => void
}

const UploadContext = createContext<UploadContextValue | null>(null)

export function useUpload() {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUpload must be used inside UploadProvider')
  return ctx
}

async function uploadFile(
  file: File,
  folderId: string,
  conflictResolution?: ConflictResolution,
): Promise<{ status: 'success' | 'skip' | 'error' | 'conflict'; existingFileName?: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folderId', folderId)
  formData.append('filename', file.name)
  if (conflictResolution) formData.append('conflictResolution', conflictResolution)

  try {
    const res = await fetch('/api/drive/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) return { status: 'error' }
    if (data.conflict) return { status: 'conflict', existingFileName: data.existingFileName }
    if (data.skipped) return { status: 'skip' }
    return { status: 'success' }
  } catch {
    return { status: 'error' }
  }
}

// Resolve or create a folder path on Drive, returning the leaf folder ID.
// folderCache maps relative path segments (e.g. "MyFolder/sub") → Drive folderId.
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
  // jobId → resolver: pauses the async loop until user picks a resolution
  const resolversRef = useRef<Map<string, (resolution: ConflictResolution) => void>>(new Map())
  // jobIds that have "skip all conflicts" enabled — avoids stale closure issues
  const autoSkipRef = useRef<Set<string>>(new Set())

  const addJob = useCallback(({
    files,
    folderId,
    folderLabel,
    projectName,
    isFolderUpload = false,
  }: AddJobParams) => {
    const jobId = crypto.randomUUID()
    const uploadedFolderName = isFolderUpload
      ? files[0]?.webkitRelativePath?.split('/')[0] ?? 'Folder'
      : undefined

    setJobs(prev => [
      ...prev,
      {
        id: jobId,
        projectName,
        folderLabel,
        folderId,
        totalFiles: files.length,
        currentIndex: 0,
        currentFileName: files[0]?.name ?? '',
        successCount: 0,
        skipCount: 0,
        errorCount: 0,
        status: 'uploading',
        uploadedFolderName,
      },
    ])

    // Fire-and-forget async loop
    ;(async () => {
      let successCount = 0
      let skipCount = 0
      let errorCount = 0

      // Cache of relative path → Drive folderId (used for folder uploads)
      const folderCache = new Map<string, string>()

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        setJobs(prev =>
          prev.map(j =>
            j.id === jobId
              ? { ...j, currentIndex: i, currentFileName: file.name, status: 'uploading' }
              : j,
          ),
        )

        // Determine target folder: for folder uploads, create intermediate dirs as needed
        let targetFolderId = folderId
        if (isFolderUpload && file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/')
          const dirParts = parts.slice(0, -1) // everything except the filename
          if (dirParts.length > 0) {
            try {
              targetFolderId = await resolveFolderPath(dirParts, folderId, folderCache)
            } catch {
              errorCount++
              setJobs(prev =>
                prev.map(j => (j.id === jobId ? { ...j, successCount, skipCount, errorCount } : j)),
              )
              continue
            }
          }
        }

        const result = await uploadFile(file, targetFolderId)

        if (result.status === 'conflict') {
          // If the user previously said "skip" for this batch, auto-skip without asking
          if (autoSkipRef.current.has(jobId)) {
            skipCount++
            setJobs(prev =>
              prev.map(j => (j.id === jobId ? { ...j, successCount, skipCount, errorCount } : j)),
            )
            continue
          }

          // Pause the loop and show conflict UI
          setJobs(prev =>
            prev.map(j =>
              j.id === jobId
                ? { ...j, status: 'conflict', conflictFileName: file.name }
                : j,
            ),
          )

          const resolution = await new Promise<ConflictResolution>(resolve => {
            resolversRef.current.set(jobId, resolve)
          })
          resolversRef.current.delete(jobId)

          // If the user chose "skip", remember it for the rest of this job's batch
          if (resolution === 'skip') {
            autoSkipRef.current.add(jobId)
            skipCount++
            setJobs(prev =>
              prev.map(j => (j.id === jobId ? { ...j, successCount, skipCount, errorCount } : j)),
            )
            continue
          }

          const retryResult = await uploadFile(file, targetFolderId, resolution)
          if (retryResult.status === 'success') successCount++
          else errorCount++
        } else if (result.status === 'success') {
          successCount++
        } else if (result.status === 'skip') {
          skipCount++
        } else {
          errorCount++
        }

        setJobs(prev =>
          prev.map(j => (j.id === jobId ? { ...j, successCount, skipCount, errorCount } : j)),
        )
      }

      autoSkipRef.current.delete(jobId)
      setJobs(prev =>
        prev.map(j =>
          j.id === jobId
            ? { ...j, status: 'done', successCount, skipCount, errorCount }
            : j,
        ),
      )
    })()
  }, [])

  const resolveConflict = useCallback((jobId: string, resolution: ConflictResolution) => {
    resolversRef.current.get(jobId)?.(resolution)
  }, [])

  const dismissJob = useCallback((jobId: string) => {
    autoSkipRef.current.delete(jobId)
    setJobs(prev => prev.filter(j => j.id !== jobId))
  }, [])

  return (
    <UploadContext.Provider value={{ jobs, addJob, resolveConflict, dismissJob }}>
      {children}
    </UploadContext.Provider>
  )
}
