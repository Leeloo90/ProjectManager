'use client'
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Loader2, MessageSquare } from 'lucide-react'

type Comment = {
  id: string
  text: string
  commenterName: string
  timecode: string | null
  insertedAt: string | null
}

type Asset = {
  id: string
  name: string
  fps: number
}

export function AssetCommentsModal({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!asset) return
    setComments([])
    setError(null)
    setLoading(true)
    fetch(`/api/frameio/comments?assetId=${asset.id}&fps=${asset.fps}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setComments(data.comments ?? [])
      })
      .catch(() => setError('Failed to load comments'))
      .finally(() => setLoading(false))
  }, [asset?.id])

  return (
    <Dialog open={!!asset} onClose={onClose} title={asset ? `Comments — ${asset.name}` : ''} className="max-w-xl">
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={22} className="animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
            <MessageSquare size={28} strokeWidth={1.5} />
            <p className="text-sm">No comments on this asset</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold text-gray-800">{c.commenterName}</span>
                    {c.timecode && (
                      <span className="text-xs font-mono bg-white border border-gray-200 text-gray-600 rounded px-1.5 py-0.5">
                        {c.timecode}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {c.insertedAt ? new Date(c.insertedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  )
}
