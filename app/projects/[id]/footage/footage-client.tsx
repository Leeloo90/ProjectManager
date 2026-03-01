'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { useUpload } from '@/components/upload-context'
import Link from 'next/link'
import {
  HardDrive, FolderOpen, ExternalLink, Upload, CheckCircle2,
  Loader2, Mic, Clapperboard,
  Palette, Music, Download, Settings, FileText, FolderUp,
} from 'lucide-react'
import { createProjectFolders } from '@/lib/actions/footage'

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

const SUBFOLDERS = [
  { key: 'rawFootageFolderId', label: 'Proxy Footage', icon: Clapperboard },
  { key: 'audioFolderId', label: 'Audio', icon: Mic },
  { key: 'graphicsFolderId', label: 'Graphics', icon: Palette },
  { key: 'musicFolderId', label: 'Music', icon: Music },
  { key: 'exportsFolderId', label: 'Exports', icon: Download },
  { key: 'projectFilesFolderId', label: 'Project Files', icon: FileText },
] as const

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
  const { addJob } = useUpload()
  const [isPending, startTransition] = useTransition()

  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const hasFolders = footage?.driveFolderId != null

  const folderOptions = SUBFOLDERS.map(sf => ({
    key: sf.key,
    label: sf.label,
    folderId: footage?.[sf.key as keyof Footage] as string | null ?? null,
  })).filter(o => o.folderId)

  const selectedFolderLabel = folderOptions.find(o => o.folderId === selectedFolderId)?.label ?? ''

  // ─── Create Folder Structure ──────────────────────────────────────────────
  function handleCreateFolders() {
    startTransition(async () => {
      const result = await createProjectFolders(projectId)
      if (result.error) {
        toast(result.error.includes('not connected') ? 'Google not connected — go to Settings' : result.error)
      } else {
        toast('Folder structure created in Google Drive')
        router.refresh()
      }
    })
  }

  // ─── Queue files for upload ───────────────────────────────────────────────
  function queueFiles(files: File[]) {
    if (!files.length || !selectedFolderId) return
    addJob({ files, folderId: selectedFolderId, folderLabel: selectedFolderLabel, projectName })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    queueFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !selectedFolderId) return
    addJob({ files, folderId: selectedFolderId, folderLabel: selectedFolderLabel, projectName, isFolderUpload: true })
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (!files.length) return
    if (!selectedFolderId) {
      toast('Please select a folder first')
      return
    }
    queueFiles(files)
  }

  // ─── Not connected state ──────────────────────────────────────────────────
  if (!googleConnected) {
    return (
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
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
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 space-y-6 max-w-3xl mx-auto w-full">

      {/* ─── Google Drive Status ──────────────────────────────────────────── */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="text-green-400 text-sm font-medium">Google connected</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Folder Structure ─────────────────────────────────────────────── */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <FolderOpen size={18} className="text-yellow-400" />
            Project Folders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasFolders ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <a
                  href={footage!.driveFolderUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  <ExternalLink size={13} />
                  Open root folder in Drive
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-white hover:bg-gray-700 text-xs"
                  onClick={handleCreateFolders}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                  Re-sync folders
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUBFOLDERS.map(({ key, label, icon: Icon }) => {
                  const folderId = footage![key as keyof Footage] as string | null
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={15} className="text-gray-400" />
                        <span className="text-sm text-gray-300">{label}</span>
                      </div>
                      {folderId ? (
                        <a
                          href={`https://drive.google.com/drive/folders/${folderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <Badge className="text-xs bg-gray-600 text-gray-400">Missing</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">
                No folder structure yet. Click below to create the following folders in Google Drive:
              </p>
              <p className="text-gray-500 text-xs font-mono bg-gray-700/50 px-3 py-2 rounded">
                {'{Company}'} / {'{Client}'} / {projectName} / Proxy Footage, Audio, Graphics, Music, Exports
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

      {/* ─── File Upload ─────────────────────────────────────────────────── */}
      {hasFolders && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Upload size={18} className="text-purple-400" />
              Upload Footage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Upload to folder</label>
              <Select
                value={selectedFolderId}
                onChange={e => setSelectedFolderId(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              >
                <option value="">Select a folder…</option>
                {folderOptions.map(o => (
                  <option key={o.key} value={o.folderId!}>{o.label}</option>
                ))}
              </Select>
            </div>

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
              />
              <div className="flex flex-col items-center gap-2">
                <Upload size={28} className={selectedFolderId ? 'text-gray-400' : 'text-gray-600'} />
                <p className="text-gray-400 text-sm">
                  {selectedFolderId
                    ? 'Drag & drop files here, or click to browse'
                    : 'Select a folder above to enable upload'}
                </p>
                {selectedFolderId && (
                  <p className="text-gray-600 text-xs">Multiple files supported — uploads continue in background</p>
                )}
              </div>
            </div>

            {selectedFolderId && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-xs text-gray-600">or</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>
            )}

            {selectedFolderId && (
              <>
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFolderChange}
                  // @ts-expect-error — webkitdirectory is valid but not in TS types
                  webkitdirectory=""
                  multiple
                />
                <Button
                  variant="outline"
                  className="w-full gap-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderUp size={16} />
                  Upload Folder
                </Button>
                <p className="text-xs text-gray-600 text-center -mt-2">
                  Folder structure will be recreated in Drive
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}
