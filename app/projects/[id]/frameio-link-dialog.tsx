'use client'
import { useState, useEffect } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Film, FolderOpen } from 'lucide-react'
import { linkFrameioProject } from '../actions'

type FrameioProject = {
  id: string
  name: string
  account_name: string
  workspace_name: string
  root_folder_id: string
  thumb_url: string | null
}

export function FrameioLinkDialog({
  open,
  onClose,
  onLinked,
  projectId,
}: {
  open: boolean
  onClose: () => void
  onLinked: () => void
  projectId: string
}) {
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<FrameioProject[]>([])
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch('/api/frameio/projects')
      .then(async res => {
        if (res.status === 401) {
          setError('Frame.io is not connected. Go to Settings → Integrations to connect.')
          return
        }
        if (!res.ok) {
          setError('Failed to load Frame.io projects.')
          return
        }
        const data = await res.json()
        setProjects(data)
      })
      .catch(() => setError('Failed to load Frame.io projects.'))
      .finally(() => setLoading(false))
  }, [open])

  async function handleSelect(item: FrameioProject) {
    setLinking(item.id)
    await linkFrameioProject(projectId, item.id, item.root_folder_id)
    onLinked()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Link Frame.io Project" className="max-w-lg">
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 size={22} className="animate-spin mr-2" /> Loading projects…
        </div>
      ) : error ? (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm text-gray-600">{error}</p>
          {error.includes('Settings') && (
            <a href="/settings?tab=integrations" className="text-sm text-blue-600 underline">
              Go to Settings
            </a>
          )}
        </div>
      ) : projects.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">No Frame.io projects found.</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto -mx-4">
          {projects.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              {item.thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumb_url}
                  alt={item.name}
                  className="w-12 h-9 rounded object-cover flex-shrink-0 bg-gray-100"
                />
              ) : (
                <div className="w-12 h-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Film size={18} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                  <FolderOpen size={11} /> {item.workspace_name} · {item.account_name}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleSelect(item)}
                disabled={linking === item.id}
              >
                {linking === item.id ? <Loader2 size={13} className="animate-spin" /> : 'Select'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
