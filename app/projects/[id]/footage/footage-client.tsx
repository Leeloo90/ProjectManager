'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useUploadActions } from '@/components/upload-context'
import Link from 'next/link'
import {
  HardDrive, FolderOpen, Upload,
  Loader2, Settings, CheckCircle2,
} from 'lucide-react'
import { createProjectFolders } from '@/lib/actions/footage'
import { RootFileExplorer } from './file-explorer'

type Footage = {
  id: string
  projectId: string
  driveFolderId: string | null
  driveFolderUrl: string | null
  rawFootageFolderId: string | null
  audioFolderId: string | null
  graphicsFolderId: string | null
  musicFolderId: string | null
  exportsFolderId: string | null
  projectFilesFolderId: string | null
}

async function traverseFileTree(entry: FileSystemEntry, path: string = ''): Promise<File[]> {
  const files: File[] = []
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    const file: File = await new Promise(resolve => fileEntry.file(resolve))
    try {
      Object.defineProperty(file, 'webkitRelativePath', {
        value: path + file.name,
        writable: true,
      })
    } catch {
      // Property may not be configurable on some browsers — safe to ignore
    }
    files.push(file)
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry
    const dirReader = dirEntry.createReader()
    // readEntries returns at most 100 entries per call — loop until empty
    let batch: FileSystemEntry[]
    do {
      batch = await new Promise(resolve => dirReader.readEntries(resolve))
      for (const subEntry of batch) {
        files.push(...await traverseFileTree(subEntry, path + entry.name + '/'))
      }
    } while (batch.length > 0)
  }
  return files;
}


const SUBFOLDER_KEYS: { key: keyof Footage; label: string }[] = [
  { key: 'audioFolderId',       label: 'Audio' },
  { key: 'exportsFolderId',     label: 'Exports' },
  { key: 'graphicsFolderId',    label: 'Graphics' },
  { key: 'musicFolderId',       label: 'Music' },
  { key: 'projectFilesFolderId', label: 'Project Files' },
  { key: 'rawFootageFolderId',  label: 'Proxy Footage' },
]

function FolderSummary({ footage, refreshKey }: { footage: Footage; refreshKey: number }) {
  const [counts, setCounts] = useState<Record<string, number | null>>(
    Object.fromEntries(SUBFOLDER_KEYS.map(f => [f.key, null]))
  )

  useEffect(() => {
    Promise.all(
      SUBFOLDER_KEYS.map(async ({ key, label: _label }) => {
        const folderId = footage[key] as string | null
        if (!folderId) return [key, 0] as const
        try {
          const res = await fetch(`/api/drive/count?folderId=${folderId}`)
          if (!res.ok) return [key, 0] as const
          const { count } = await res.json()
          return [key, count as number] as const
        } catch {
          return [key, 0] as const
        }
      })
    ).then(results => setCounts(Object.fromEntries(results)))
  }, [footage, refreshKey])

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
          <HardDrive size={15} className="text-blue-400" />
          Drive Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {SUBFOLDER_KEYS.map(({ key, label }) => {
            const count = counts[key]
            const hasFiles = count !== null && count > 0
            return (
              <div key={key} className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <FolderOpen size={12} className={hasFiles ? 'text-yellow-400 flex-shrink-0' : 'text-gray-600 flex-shrink-0'} />
                  <span className={`text-xs truncate ${hasFiles ? 'text-white' : 'text-gray-500'}`}>{label}</span>
                  {hasFiles && <CheckCircle2 size={11} className="text-green-400 flex-shrink-0 ml-auto" />}
                </div>
                <p className="text-xs italic text-gray-600 mt-0.5 pl-[18px]">
                  {count === null ? '—' : `${count} item${count !== 1 ? 's' : ''}`}
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function FootageClient({
  projectId,
  projectName,
  googleConnected,
  footage,
}: {
  projectId: string
  projectName: string
  googleConnected: boolean
  footage: Footage | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { addJob } = useUploadActions()
  const [isPending, startTransition] = useTransition()

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedFolderLabel, setSelectedFolderLabel] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasFolders = footage?.driveFolderId != null

  const handleSelectFolder = useCallback((id: string, name: string) => {
    setSelectedFolderId(id)
    setSelectedFolderLabel(name)
  }, [])

  // ─── Create Folder Structure ──────────────────────────────────────────────
  function handleCreateFolders() {
    startTransition(async () => {
      const result = await createProjectFolders(projectId)
      if (result.error) {
        toast(result.error.includes('not connected') ? 'Google not connected — go to Settings' : result.error, 'error')
      } else {
        toast('Folder structure created in Google Drive', 'success')
        router.refresh()
      }
    })
  }

  // ─── Queue files for upload ───────────────────────────────────────────────
  function queueFiles(files: File[], isFolderUpload = false) {
    if (!files.length || !selectedFolderId) return
    const label = selectedFolderLabel
    addJob({
      files, folderId: selectedFolderId, folderLabel: label, projectName, isFolderUpload,
      onComplete: () => {
        setRefreshKey(k => k + 1)
        toast(`Finished uploading to "${label}".`, 'success')
      },
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    // When a folder is selected, webkitdirectory is true, and the files have a path
    const isFolderUpload = files.some(f => f.webkitRelativePath)
    queueFiles(files, isFolderUpload)
    e.target.value = ''
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (!selectedFolderId) {
      toast('Please select a folder first', 'error')
      return
    }

    // Capture all entries synchronously before any await — DataTransfer is invalidated after the first await
    const entries: FileSystemEntry[] = []
    for (const item of Array.from(e.dataTransfer.items)) {
      const entry = item.webkitGetAsEntry()
      if (entry) entries.push(entry)
    }

    const looseFiles: File[] = []

    for (const entry of entries) {
      if (entry.isDirectory) {
        // Each dropped folder becomes its own queued job
        const files = await traverseFileTree(entry)
        if (files.length > 0) {
          const label = selectedFolderLabel
          addJob({
            files, folderId: selectedFolderId, folderLabel: label, projectName, isFolderUpload: true,
            onComplete: () => {
              setRefreshKey(k => k + 1)
              toast(`Finished uploading to "${label}".`, 'success')
            },
          })
        }
      } else {
        // Loose files accumulate into one job below
        const files = await traverseFileTree(entry)
        looseFiles.push(...files)
      }
    }

    // All loose files in a single job
    if (looseFiles.length > 0) {
      const label = selectedFolderLabel
      addJob({
        files: looseFiles, folderId: selectedFolderId, folderLabel: label, projectName, isFolderUpload: false,
        onComplete: () => {
          setRefreshKey(k => k + 1)
          toast(`Finished uploading to "${label}".`, 'success')
        },
      })
    }
  }

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-3 gap-6 items-start">
        <div className="col-span-2">
          {/* ─── Folder Structure ─────────────────────────────────────────────── */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <FolderOpen size={18} className="text-yellow-400" />
                Project Folders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!googleConnected ? (
                <div className="py-10 flex flex-col items-center gap-4 text-center">
                  <HardDrive size={36} className="text-gray-600" />
                  <div>
                    <p className="text-white font-medium mb-1">Google not connected</p>
                    <p className="text-gray-400 text-sm">Connect your Google account in Settings to enable Drive footage management.</p>
                  </div>
                  <Link href="/settings?tab=integrations">
                    <Button variant="outline" className="gap-2 text-gray-300 border-gray-600 hover:bg-gray-700">
                      <Settings size={15} /> Go to Settings
                    </Button>
                  </Link>
                </div>
              ) : hasFolders && footage.driveFolderId ? (
                <RootFileExplorer 
                  folderId={footage.driveFolderId}
                  folderName={projectName}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={handleSelectFolder}
                  refreshKey={refreshKey}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm">
                    No folder structure yet. Click below to create the standard folders in Google Drive.
                  </p>
                  <p className="text-gray-500 text-xs font-mono bg-gray-700/50 px-3 py-2 rounded">
                    {'{Company}'} / {'{Client}'} / {projectName} / ...
                  </p>
                  <Button
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleCreateFolders}
                    disabled={isPending}
                  >
                    {isPending
                      ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
                      : <><FolderOpen size={16} /> Create Project Folders</>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1">
        {/* ─── File Upload ─────────────────────────────────────────────────── */}
        {hasFolders && footage && (
          <div className="mb-4">
            <FolderSummary footage={footage} refreshKey={refreshKey} />
          </div>
        )}

        {googleConnected && hasFolders && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Upload size={18} className="text-purple-400" />
                Upload Footage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedFolderId && (
                <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-white">
                  Uploading to: <span className="font-medium text-yellow-300">{selectedFolderLabel}</span>
                </div>
              )}

              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver
                    ? 'border-blue-400 bg-blue-900/20'
                    : selectedFolderId
                    ? 'border-gray-600 hover:border-gray-500 cursor-pointer'
                    : 'border-gray-700 opacity-50 cursor-not-allowed'
                }`}
                onDragOver={e => { e.preventDefault(); if (selectedFolderId) setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => { if (selectedFolderId) fileInputRef.current?.click() }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={!selectedFolderId}
                  // @ts-expect-error — webkitdirectory is valid but not in TS types
                  webkitdirectory=""
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload size={28} className={selectedFolderId ? 'text-gray-400' : 'text-gray-600'} />
                  <p className="text-gray-400 text-sm">
                    {selectedFolderId
                      ? 'Drag & drop files or folders here, or click to browse'
                      : 'Select a folder from the list above to enable upload'}
                  </p>
                  {selectedFolderId && (
                    <p className="text-gray-600 text-xs">Multiple files and folders supported</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  )
}


