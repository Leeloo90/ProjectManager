'use client'
import { useState, useEffect, useCallback } from 'react'
import { Folder, Film, Image, FileText, Loader2, MessageSquare, ChevronRight } from 'lucide-react'
import { FrameioAssetViewer } from './frameio-asset-viewer'

type FolderItem = {
  id: string
  name: string
  type: 'file' | 'folder' | 'version_stack'
  thumb_url: string | null
  duration: number | null
  comment_count: number
  media_type: string | null
}

type Breadcrumb = { id: string; name: string }

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ItemIcon({ item, size = 32 }: { item: FolderItem; size?: number }) {
  if (item.type === 'folder') return <Folder size={size} className="text-amber-400" />
  const mt = item.media_type ?? ''
  if (mt.startsWith('video') || item.type === 'version_stack') return <Film size={size} className="text-blue-400" />
  if (mt.startsWith('image')) return <Image size={size} className="text-green-400" />
  return <FileText size={size} className="text-gray-400" />
}

function GridIcon() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <rect x="1" y="2" width="14" height="2" rx="1" />
      <rect x="1" y="7" width="14" height="2" rx="1" />
      <rect x="1" y="12" width="14" height="2" rx="1" />
    </svg>
  )
}

export function FrameioExplorer({
  rootFolderId,
  projectName,
}: {
  rootFolderId: string
  projectName: string
  projectId: string
}) {
  const [currentFolderId, setCurrentFolderId] = useState(rootFolderId)
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: rootFolderId, name: projectName }])
  const [items, setItems] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FolderItem | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [accountId, setAccountId] = useState<string>(process.env.NEXT_PUBLIC_FRAMEIO_ACCOUNT_ID ?? '')

  const loadFolder = useCallback(async (folderId: string, knownAccountId: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ folderId })
      if (knownAccountId) params.set('accountId', knownAccountId)
      const res = await fetch(`/api/frameio/folder?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to load folder contents.')
        return
      }
      const data: { items: FolderItem[]; resolvedAccountId: string } = await res.json()
      setItems(data.items)
      if (data.resolvedAccountId) setAccountId(data.resolvedAccountId)
    } catch {
      setError('Failed to load folder contents.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFolder(currentFolderId, accountId)
    // accountId intentionally omitted — we only want to re-run when folderId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, loadFolder])

  function navigateInto(item: FolderItem) {
    setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }])
    setCurrentFolderId(item.id)
  }

  function navigateToBreadcrumb(crumb: Breadcrumb, index: number) {
    setBreadcrumbs(prev => prev.slice(0, index + 1))
    setCurrentFolderId(crumb.id)
  }

  const folders = items.filter(i => i.type === 'folder')
  const files = items.filter(i => i.type !== 'folder')

  if (selectedFile) {
    return (
      <FrameioAssetViewer
        file={selectedFile}
        accountId={accountId}
        onClose={() => setSelectedFile(null)}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Breadcrumbs + view toggle */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 text-sm overflow-x-auto">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
              {i > 0 && <ChevronRight size={14} className="text-gray-600" />}
              <button
                onClick={() => navigateToBreadcrumb(crumb, i)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  i === breadcrumbs.length - 1
                    ? 'text-white font-medium cursor-default'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1 flex-shrink-0 ml-2">
          <button
            onClick={() => setViewMode('grid')}
            title="Grid view"
            className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <GridIcon />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500">
            <Loader2 size={22} className="animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
            This folder is empty.
          </div>
        ) : viewMode === 'grid' ? (
          <>
            {/* Folders — grid */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Folders</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {folders.map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigateInto(item)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg transition-colors text-left"
                      style={{ background: 'rgb(31 41 55)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgb(38 50 65)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgb(31 41 55)')}
                    >
                      <Folder size={36} className="text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-gray-300 text-center line-clamp-2 leading-tight w-full">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Files — grid */}
            {files.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Files</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {files.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedFile(item)}
                      className="flex flex-col rounded-lg overflow-hidden transition-all text-left"
                      style={{ background: 'rgb(31 41 55)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgb(38 50 65)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgb(31 41 55)')}
                    >
                      <div className="aspect-video w-full bg-gray-900 flex items-center justify-center relative overflow-hidden">
                        {item.thumb_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumb_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <ItemIcon item={item} />
                        )}
                        {item.comment_count > 0 && (
                          <span className="absolute top-1.5 right-1.5 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <MessageSquare size={10} />
                            {item.comment_count}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-gray-200 truncate">{item.name}</p>
                        {item.duration != null && item.duration > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5">{formatDuration(item.duration)}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* List view — folders and files together */
          <div className="space-y-0.5">
            {folders.map(item => (
              <button
                key={item.id}
                onClick={() => navigateInto(item)}
                className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800 transition-colors text-left"
              >
                <div className="w-12 h-9 flex items-center justify-center flex-shrink-0">
                  <Folder size={22} className="text-amber-400" />
                </div>
                <span className="flex-1 text-sm text-gray-200 truncate">{item.name}</span>
              </button>
            ))}

            {files.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedFile(item)}
                className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800 transition-colors text-left"
              >
                {/* Thumbnail or icon */}
                <div className="w-12 h-9 bg-gray-900 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                  {item.thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumb_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ItemIcon item={item} size={20} />
                  )}
                </div>

                {/* Name */}
                <span className="flex-1 text-sm text-gray-200 truncate">{item.name}</span>

                {/* Duration */}
                {item.duration != null && item.duration > 0 && (
                  <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
                    {formatDuration(item.duration)}
                  </span>
                )}

                {/* Comment count */}
                {item.comment_count > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-500 flex-shrink-0">
                    <MessageSquare size={11} />
                    {item.comment_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
