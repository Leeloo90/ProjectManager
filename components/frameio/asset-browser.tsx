'use client'
import { useState, useCallback } from 'react'
import { Loader2, Folder, FileVideo, ChevronRight, MessageSquare, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AssetCommentsModal } from './asset-comments-modal'

type Asset = {
  id: string
  name: string
  type: string
  insertedAt: string | null
  commentCount: number
  fps: number
  filesize: number | null
}

type FolderEntry = { id: string; name: string }

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function AssetBrowser({
  frameioProjectId,
  rootAssetId,
  accountId,
  projectName,
}: {
  frameioProjectId: string
  rootAssetId: string | null
  accountId: string | null
  projectName: string
}) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [folderStack, setFolderStack] = useState<FolderEntry[]>([])
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  const fetchAssets = useCallback(async (folderId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const resolvedFolderId = folderId ?? rootAssetId ?? null
      const params = new URLSearchParams()
      if (accountId) params.set('accountId', accountId)
      if (resolvedFolderId) {
        params.set('folderId', resolvedFolderId)
      } else {
        params.set('projectId', frameioProjectId)
      }
      const res = await fetch(`/api/frameio/assets?${params.toString()}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setAssets([])
      } else {
        setAssets(data.assets ?? [])
      }
    } catch {
      setError('Failed to load assets')
      setAssets([])
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [frameioProjectId, rootAssetId, accountId])

  function handleSync() {
    const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : undefined
    fetchAssets(currentFolderId)
  }

  function handleFolderClick(folder: Asset) {
    setFolderStack(prev => [...prev, { id: folder.id, name: folder.name }])
    fetchAssets(folder.id)
  }

  function handleBreadcrumbClick(index: number) {
    if (index === -1) {
      setFolderStack([])
      fetchAssets(undefined)
    } else {
      const newStack = folderStack.slice(0, index + 1)
      setFolderStack(newStack)
      fetchAssets(newStack[newStack.length - 1].id)
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: breadcrumb + sync */}
      <div className="flex items-center justify-between gap-2">
        <nav className="flex items-center gap-1 text-sm flex-wrap min-w-0">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            className={`hover:text-gray-900 transition-colors truncate max-w-[140px] ${folderStack.length === 0 ? 'text-gray-900 font-medium cursor-default' : 'text-blue-600'}`}
            disabled={folderStack.length === 0}
          >
            {projectName}
          </button>
          {folderStack.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1 min-w-0">
              <ChevronRight size={13} className="text-gray-400 shrink-0" />
              <button
                onClick={() => handleBreadcrumbClick(i)}
                className={`hover:text-gray-900 transition-colors truncate max-w-[120px] ${i === folderStack.length - 1 ? 'text-gray-900 font-medium cursor-default' : 'text-blue-600'}`}
                disabled={i === folderStack.length - 1}
              >
                {f.name}
              </button>
            </span>
          ))}
        </nav>

        <Button size="sm" variant="outline" onClick={handleSync} disabled={loading} className="shrink-0">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loaded ? 'Refresh' : 'Sync'}
        </Button>
      </div>

      {/* Content */}
      {!loaded && !loading ? (
        <p className="text-sm text-gray-400 py-4">Click Sync to load assets from Frame.io.</p>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500 py-2">{error}</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-gray-400">
          {folderStack.length === 0 ? 'No assets in this project.' : `"${folderStack[folderStack.length - 1].name}" is empty.`}
        </p>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {assets.map(asset => {
            const isFolder = asset.type === 'folder'
            return (
              <button
                key={asset.id}
                onClick={() => isFolder ? handleFolderClick(asset) : setSelectedAsset(asset)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                {isFolder ? (
                  <Folder size={16} className="text-yellow-500 shrink-0" />
                ) : (
                  <FileVideo size={16} className="text-blue-500 shrink-0" />
                )}

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800 truncate">{asset.name}</span>
                  <span className="text-xs text-gray-400">
                    {isFolder ? 'Folder' : formatDate(asset.insertedAt)}
                    {!isFolder && asset.filesize ? ` · ${formatBytes(asset.filesize)}` : ''}
                  </span>
                </span>

                {!isFolder && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <MessageSquare size={12} />
                    {asset.commentCount}
                  </span>
                )}

                {isFolder && (
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}

      <AssetCommentsModal
        asset={selectedAsset ? { id: selectedAsset.id, name: selectedAsset.name, fps: selectedAsset.fps } : null}
        onClose={() => setSelectedAsset(null)}
      />
    </div>
  )
}
