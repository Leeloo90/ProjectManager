'use client'
import { useState, useEffect, useTransition } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Clapperboard, Check } from 'lucide-react'
import { linkFrameIoProject } from '@/app/frameio/actions'
import { useRouter } from 'next/navigation'

type FrameioProject = {
  id: string
  name: string
  updated_at: string | null
  root_asset_id: string | null
  account_id: string
  workspace_id: string
}

export function LinkProjectModal({
  appProjectId,
  open,
  onClose,
}: {
  appProjectId: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [projects, setProjects] = useState<FrameioProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linking, startLinkTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setSelectedId(null)
    setError(null)
    setLoading(true)
    fetch('/api/frameio/projects')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setProjects(data.projects ?? [])
        }
      })
      .catch(() => setError('Could not load Frame.io projects'))
      .finally(() => setLoading(false))
  }, [open])

  function handleLink() {
    if (!selectedId) return
    const proj = projects.find(p => p.id === selectedId)
    if (!proj) return
    startLinkTransition(async () => {
      await linkFrameIoProject(appProjectId, proj.id, proj.name, proj.root_asset_id, proj.workspace_id)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Link Frame.io Project">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Select a Frame.io project to link to this project. Comments will be synced automatically.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-gray-400" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No Frame.io projects found.</p>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {projects.map(proj => (
              <button
                key={proj.id}
                onClick={() => setSelectedId(proj.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors text-sm
                  ${selectedId === proj.id
                    ? 'bg-[#1e3a5f] text-white'
                    : 'hover:bg-gray-50 text-gray-800'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Clapperboard size={15} className={selectedId === proj.id ? 'text-white/70' : 'text-gray-400'} />
                  <span className="font-medium">{proj.name}</span>
                </div>
                {selectedId === proj.id && <Check size={15} />}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={linking}>Cancel</Button>
          <Button onClick={handleLink} disabled={!selectedId || linking}>
            {linking ? <><Loader2 size={14} className="animate-spin" /> Linking...</> : 'Link Project'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
