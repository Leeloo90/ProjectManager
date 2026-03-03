'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import {
  addRevisionEntry,
  promoteRevision,
  demoteRevision,
  refreshRevisionComments,
  updateRevisionNotes,
} from '../../actions'
import Link from 'next/link'
import {
  Plus, RefreshCw, ChevronDown, ChevronUp, Copy, Check,
  AlertTriangle, ArrowUp, ArrowDown, MessageSquare,
  ExternalLink, Film, Link2Off, Folder, Image, FileText,
  ChevronLeft, Upload, FolderOpen, Loader2, CloudUpload,
} from 'lucide-react'

type Revision = {
  id: string
  orderId: number
  category: 'INT' | 'EXT'
  intNumber: number | null
  extNumber: number | null
  title: string
  frameioAssetId: string | null
  frameioShareLink: string | null
  thumbnailUrl: string | null
  commentCount: number | null
  notes: string | null
  createdAt: string | null
}

type BrowseItem = {
  id: string
  name: string
  type: 'file' | 'folder' | 'version_stack'
  thumb_url: string | null
  duration: number | null
  comment_count: number
  media_type: string | null
}

type Breadcrumb = { id: string; name: string }

type CardComment = {
  id: string
  text: string
  timestamp: string | null
  owner: { name: string; email: string | null; avatar_url: string | null }
  replies: CardComment[]
  created_at: string | null
}

function timecodeToSeconds(tc: string | null | undefined): number {
  if (!tc || typeof tc !== 'string') return 0
  const parts = tc.split(':')
  if (parts.length !== 4) return 0
  const [h, m, s] = parts.map(Number)
  return h * 3600 + m * 60 + s
}

function formatTimecode(tc: string | null | undefined): string {
  const secs = timecodeToSeconds(tc)
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getLabel(revision: Pick<Revision, 'category' | 'intNumber' | 'extNumber'>) {
  if (revision.category === 'INT') {
    return `Internal ${revision.intNumber ?? ''}`
  }
  // EXT: first delivery = "First Draft", subsequent = "Revision N"
  if (revision.extNumber === 1) return 'First Draft'
  return `Revision ${(revision.extNumber ?? 2) - 1}`
}

function CategoryBadge({ category }: { category: 'INT' | 'EXT' }) {
  return (
    <span
      className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
        category === 'EXT'
          ? 'bg-blue-900/50 text-blue-300 border-blue-700/50'
          : 'bg-gray-700 text-gray-400 border-gray-600'
      }`}
    >
      {category}
    </span>
  )
}

function CopyShareLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast('Share link copied', 'success')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
      aria-label="Copy share link"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      <span className="text-xs">{copied ? 'Copied' : 'Copy link'}</span>
    </button>
  )
}

function sortComments(data: CardComment[]): CardComment[] {
  return [...data].sort((a, b) => {
    if (a.timestamp && b.timestamp) return timecodeToSeconds(a.timestamp) - timecodeToSeconds(b.timestamp)
    if (a.timestamp) return -1
    if (b.timestamp) return 1
    return 0
  })
}

function fetchComments(fileId: string): Promise<CardComment[]> {
  return fetch(`/api/frameio/comments?fileId=${encodeURIComponent(fileId)}`)
    .then(res => res.ok ? res.json() : [])
    .then(sortComments)
    .catch(() => [])
}

function CommentColumn({
  label,
  assetId,
  comments,
  loading,
  fetched,
}: {
  label: string
  assetId: string | null
  comments: CardComment[]
  loading: boolean
  fetched: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-gray-300 pb-1.5 border-b border-gray-700">{label}</p>
      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 py-2">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      )}
      {!loading && !assetId && (
        <p className="text-xs text-gray-600 italic py-1">No Frame.io asset linked</p>
      )}
      {!loading && assetId && fetched && comments.length === 0 && (
        <p className="text-xs text-gray-500 py-1">No comments from {label}</p>
      )}
      {!loading && comments.map(c => {
        const name = c.owner.name || c.owner.email || 'Guest'
        return (
          <div key={c.id} className="bg-gray-900 rounded-lg p-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-200 truncate flex-1">{name}</span>
              {c.timestamp && (
                <span className="text-xs font-mono text-orange-400 bg-orange-900/20 px-1.5 py-0.5 rounded shrink-0">
                  {formatTimecode(c.timestamp)}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-300 leading-snug break-words">{c.text}</p>
            {c.replies.length > 0 && (
              <p className="text-xs text-gray-600">{c.replies.length} {c.replies.length === 1 ? 'reply' : 'replies'}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RevisionCard({
  revision,
  previousRevision,
  isLatest,
  projectId,
}: {
  revision: Revision
  previousRevision: Pick<Revision, 'frameioAssetId' | 'category' | 'intNumber' | 'extNumber'> | null
  isLatest: boolean
  projectId: string
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Notes
  const [localNotes, setLocalNotes] = useState(revision.notes ?? '')
  const [savedNotes, setSavedNotes] = useState(revision.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  // Auto-size textarea when expanded (handles pre-existing content)
  useEffect(() => {
    if (expanded && notesRef.current) {
      const el = notesRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [expanded])

  function handleNotesBlur() {
    if (localNotes === savedNotes) return
    startTransition(async () => {
      await updateRevisionNotes(revision.id, localNotes)
      setSavedNotes(localNotes)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    })
  }

  // Current revision comments
  const [currComments, setCurrComments] = useState<CardComment[]>([])
  const [loadingCurr, setLoadingCurr] = useState(false)
  const [currFetched, setCurrFetched] = useState(false)

  // Previous revision comments
  const [prevComments, setPrevComments] = useState<CardComment[]>([])
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [prevFetched, setPrevFetched] = useState(false)

  useEffect(() => {
    if (!expanded) return

    if (!currFetched && revision.frameioAssetId) {
      setLoadingCurr(true)
      fetchComments(revision.frameioAssetId)
        .then(data => { setCurrComments(data); setCurrFetched(true) })
        .finally(() => setLoadingCurr(false))
    }

    if (!prevFetched && previousRevision?.frameioAssetId) {
      setLoadingPrev(true)
      fetchComments(previousRevision.frameioAssetId)
        .then(data => { setPrevComments(data); setPrevFetched(true) })
        .finally(() => setLoadingPrev(false))
    } else if (!prevFetched) {
      setPrevFetched(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  function handlePromote() {
    startTransition(async () => {
      await promoteRevision(revision.id, projectId)
      toast('Promoted to External', 'success')
      router.refresh()
    })
  }

  function handleDemote() {
    startTransition(async () => {
      await demoteRevision(revision.id, projectId)
      toast('Demoted to Internal', 'success')
      router.refresh()
    })
  }

  const label = getLabel(revision)
  const dateStr = revision.createdAt
    ? formatDate(revision.createdAt.includes('T') ? revision.createdAt.split('T')[0] : revision.createdAt)
    : null

  return (
    <Card className="bg-gray-800 border-gray-700 overflow-hidden">
      <CardContent className="p-4 space-y-3">

        {/* Row 1: label + badge + expand toggle */}
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">{label}</span>
          <CategoryBadge category={revision.category} />
          <button
            onClick={() => setExpanded(e => !e)}
            className="ml-auto text-gray-400 hover:text-white transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Row 2: thumbnail + title */}
        <div className="flex gap-3 items-start">
          <div className="w-20 h-12 rounded bg-gray-700 flex-shrink-0 overflow-hidden">
            {revision.thumbnailUrl ? (
              <img src={revision.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film size={16} className="text-gray-500" />
              </div>
            )}
          </div>
          <p className="text-sm text-gray-200 leading-snug pt-0.5">{revision.title}</p>
        </div>

        {/* Row 3: meta (comments, copy link, date, notes indicator) */}
        <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <MessageSquare size={11} />
            {revision.commentCount ?? 0} comment{(revision.commentCount ?? 0) !== 1 ? 's' : ''}
          </span>
          {revision.frameioShareLink && (
            <CopyShareLinkButton url={revision.frameioShareLink} />
          )}
          {dateStr && <span>{dateStr}</span>}
          {!expanded && savedNotes && (
            <span className="text-amber-400/70 italic">Notes added</span>
          )}
        </div>

        {/* Expanded: iframe + two-column comment comparison */}
        {expanded && (
          <div className="space-y-3 pt-1">
            {revision.frameioShareLink && (
              <div className="space-y-1.5">
                <iframe
                  src={revision.frameioShareLink}
                  className="w-full aspect-video rounded border border-gray-700"
                  allowFullScreen
                  allow="autoplay; fullscreen"
                />
                <a
                  href={revision.frameioShareLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink size={11} /> Open in Frame.io
                </a>
              </div>
            )}

            {/* Side-by-side: previous revision comments (left) / this revision (right) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <CommentColumn
                label={previousRevision ? getLabel(previousRevision) : 'Previous revision'}
                assetId={previousRevision?.frameioAssetId ?? null}
                comments={prevComments}
                loading={loadingPrev}
                fetched={prevFetched}
              />
              <CommentColumn
                label={label}
                assetId={revision.frameioAssetId}
                comments={currComments}
                loading={loadingCurr}
                fetched={currFetched}
              />
            </div>

            {/* Editor notes */}
            <div className="relative">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Editor notes</p>
              <textarea
                ref={notesRef}
                value={localNotes}
                onChange={e => setLocalNotes(e.target.value)}
                onBlur={handleNotesBlur}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = el.scrollHeight + 'px'
                }}
                placeholder="Add notes…"
                rows={2}
                className="w-full rounded bg-gray-700/60 border border-gray-600 text-xs text-gray-200 placeholder-gray-500 px-2.5 py-2 resize-none overflow-hidden focus:outline-none focus:border-gray-500 transition-colors"
              />
              {notesSaved && (
                <span className="absolute bottom-2 right-2 text-[10px] text-emerald-400 pointer-events-none">Saved</span>
              )}
            </div>
          </div>
        )}

        {/* Promote / Demote — only on the latest card */}
        {isLatest && (
          <div className="pt-1 border-t border-gray-700">
            {revision.category === 'INT' ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs border-blue-700/50 text-blue-400 hover:bg-blue-900/30"
                onClick={handlePromote}
                disabled={isPending}
              >
                <ArrowUp size={13} /> Promote to External
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs border-gray-600 text-gray-400 hover:bg-gray-700"
                onClick={handleDemote}
                disabled={isPending}
              >
                <ArrowDown size={13} /> Demote to Internal
              </Button>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  )
}

// ─── Mini Frame.io asset browser ─────────────────────────────────────────

function BrowseItemIcon({ item }: { item: BrowseItem }) {
  if (item.type === 'folder') return <Folder size={16} className="text-amber-400 shrink-0" />
  const mt = item.media_type ?? ''
  if (mt.startsWith('video') || item.type === 'version_stack') return <Film size={16} className="text-blue-400 shrink-0" />
  if (mt.startsWith('image')) return <Image size={16} className="text-green-400 shrink-0" />
  return <FileText size={16} className="text-gray-400 shrink-0" />
}

function FrameioAssetBrowser({
  rootFolderId,
  onSelect,
}: {
  rootFolderId: string
  onSelect: (item: BrowseItem) => void
}) {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: rootFolderId, name: 'Project' }])
  const [items, setItems] = useState<BrowseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  const loadFolder = useCallback(async (folderId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/frameio/folder?folderId=${encodeURIComponent(folderId)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to load folder.')
        return
      }
      const data = await res.json()
      setItems(data.items ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load root on first render
  if (!loadedRef.current) {
    loadedRef.current = true
    loadFolder(rootFolderId)
  }

  function navigateInto(item: BrowseItem) {
    setBreadcrumbs(bc => [...bc, { id: item.id, name: item.name }])
    loadFolder(item.id)
  }

  function navigateTo(index: number) {
    const bc = breadcrumbs.slice(0, index + 1)
    setBreadcrumbs(bc)
    loadFolder(bc[bc.length - 1].id)
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '320px' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-4 pb-2 flex-wrap">
        {breadcrumbs.map((bc, i) => (
          <span key={bc.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-600 text-xs">/</span>}
            <button
              onClick={() => navigateTo(i)}
              className={`text-xs transition-colors ${
                i === breadcrumbs.length - 1
                  ? 'text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {bc.name}
            </button>
          </span>
        ))}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="text-gray-500 animate-spin" />
          </div>
        )}
        {error && (
          <p className="text-red-400 text-sm py-4 text-center">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="text-gray-500 text-sm py-4 text-center">No items in this folder.</p>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="space-y-0.5">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => item.type === 'folder' ? navigateInto(item) : onSelect(item)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-700 transition-colors text-left"
              >
                <div className="w-10 h-7 rounded bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.thumb_url && item.type !== 'folder' ? (
                    <img src={item.thumb_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BrowseItemIcon item={item} />
                  )}
                </div>
                <span className="text-sm text-gray-200 flex-1 truncate">{item.name}</span>
                {item.type === 'folder' ? (
                  <ChevronDown size={14} className="text-gray-500 shrink-0 -rotate-90" />
                ) : (
                  <span className="text-xs text-blue-400 shrink-0">Select</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Upload drop zone ─────────────────────────────────────────────────────

function UploadDropZone({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelected(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
  }

  return (
    <div className="px-6 pb-6 pt-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-full border-2 border-dashed rounded-xl py-14 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
          dragging
            ? 'border-blue-500 bg-blue-900/10'
            : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
        }`}
      >
        <CloudUpload size={32} className={dragging ? 'text-blue-400' : 'text-gray-500'} />
        <div className="text-center">
          <p className="text-sm text-gray-200 font-medium">Drop a file here</p>
          <p className="text-xs text-gray-500 mt-0.5">or click to browse — video or image</p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}

// ─── Confirmation screen (shared between browse & upload) ─────────────────

function AssetConfirmation({
  asset,
  projectId,
  frameioRootFolderId,
  onBack,
  onClose,
}: {
  asset: {
    id: string | null
    name: string
    thumbnailUrl: string | null
    isUpload?: boolean
    file?: File
  }
  projectId: string
  frameioRootFolderId: string | null
  onBack: () => void
  onClose: () => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [category, setCategory] = useState<'INT' | 'EXT'>('EXT')
  const [isPending, startTransition] = useTransition()
  const [statusText, setStatusText] = useState('')

  function handleAdd() {
    startTransition(async () => {
      try {
        let assetId = asset.id
        let assetName = asset.name
        let thumbnailUrl = asset.thumbnailUrl

        // Upload step — only for upload flow
        if (asset.isUpload && asset.file) {
          setStatusText('Uploading to Frame.io…')
          const fd = new FormData()
          fd.append('file', asset.file)
          if (frameioRootFolderId) fd.append('folderId', frameioRootFolderId)
          const uploadRes = await fetch('/api/frameio/upload', { method: 'POST', body: fd })
          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}))
            toast(err.error ?? 'Upload failed', 'error')
            return
          }
          const uploadData = await uploadRes.json()
          assetId = uploadData.assetId
          assetName = uploadData.name ?? assetName
          thumbnailUrl = uploadData.thumbnailUrl ?? null
        }

        // Create Frame.io review link
        let shareLink: string | null = null
        if (assetId) {
          setStatusText('Creating share link…')
          const rlRes = await fetch('/api/frameio/review-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetId, name: assetName }),
          })
          if (rlRes.ok) {
            const rlData = await rlRes.json()
            shareLink = rlData.url ?? null
          }
          // Non-fatal — revision saves even without a share link
        }

        setStatusText('Saving…')
        await addRevisionEntry(projectId, {
          category,
          title: assetName,
          frameioAssetId: assetId ?? undefined,
          frameioShareLink: shareLink ?? undefined,
          thumbnailUrl: thumbnailUrl ?? undefined,
        })

        toast('Revision added', 'success')
        onClose()
        router.refresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        toast(msg, 'error')
      }
    })
  }

  return (
    <div className="p-6 space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
        disabled={isPending}
      >
        <ChevronLeft size={14} /> Back
      </button>

      {/* Asset preview */}
      <div className="flex gap-4 items-start">
        <div className="w-24 h-16 rounded bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Film size={20} className="text-gray-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-snug break-words">{asset.name}</p>
          <p className="text-gray-500 text-xs mt-1">This will be used as the revision title.</p>
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Category</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCategory('INT')}
            className={`flex-1 py-2 text-sm rounded border transition-colors ${
              category === 'INT'
                ? 'bg-gray-600 border-gray-500 text-white'
                : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            Internal
          </button>
          <button
            type="button"
            onClick={() => setCategory('EXT')}
            className={`flex-1 py-2 text-sm rounded border transition-colors ${
              category === 'EXT'
                ? 'bg-blue-700 border-blue-600 text-white'
                : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            External
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleAdd} disabled={isPending} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          {isPending ? (
            <><Loader2 size={14} className="animate-spin" /> {statusText || 'Saving…'}</>
          ) : (
            'Add Revision'
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Add Revision Dialog ──────────────────────────────────────────────────

type DialogMode = 'pick-source' | 'browse' | 'upload' | 'confirm'

function AddRevisionDialog({
  projectId,
  frameioRootFolderId,
  onClose,
}: {
  projectId: string
  frameioRootFolderId: string | null
  onClose: () => void
}) {
  const [mode, setMode] = useState<DialogMode>('pick-source')
  const [selectedAsset, setSelectedAsset] = useState<{
    id: string | null
    name: string
    thumbnailUrl: string | null
    isUpload?: boolean
    file?: File
  } | null>(null)

  function handleBrowseSelect(item: BrowseItem) {
    setSelectedAsset({ id: item.id, name: item.name, thumbnailUrl: item.thumb_url })
    setMode('confirm')
  }

  function handleFileSelected(file: File) {
    setSelectedAsset({
      id: null,
      name: file.name.replace(/\.[^/.]+$/, ''), // strip extension for cleaner title
      thumbnailUrl: null,
      isUpload: true,
      file,
    })
    setMode('confirm')
  }

  if (mode === 'confirm' && selectedAsset) {
    return (
      <AssetConfirmation
        asset={selectedAsset}
        projectId={projectId}
        frameioRootFolderId={frameioRootFolderId}
        onBack={() => setMode(selectedAsset.isUpload ? 'upload' : 'browse')}
        onClose={onClose}
      />
    )
  }

  if (mode === 'browse' && frameioRootFolderId) {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-4 pb-1">
          <button
            onClick={() => setMode('pick-source')}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors mb-2"
          >
            <ChevronLeft size={14} /> Back
          </button>
        </div>
        <FrameioAssetBrowser rootFolderId={frameioRootFolderId} onSelect={handleBrowseSelect} />
      </div>
    )
  }

  if (mode === 'upload') {
    return (
      <div>
        <div className="px-6 pt-6 pb-0">
          <button
            onClick={() => setMode('pick-source')}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={14} /> Back
          </button>
        </div>
        <UploadDropZone onFileSelected={handleFileSelected} />
      </div>
    )
  }

  // Default: pick-source
  return (
    <div className="p-6 space-y-3">
      <p className="text-sm text-gray-400 mb-2">How do you want to add this revision?</p>

      <button
        onClick={() => setMode('browse')}
        disabled={!frameioRootFolderId}
        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-blue-900/40 flex items-center justify-center shrink-0">
          <FolderOpen size={20} className="text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Browse Frame.io</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Pick an existing asset from the linked Frame.io project
          </p>
        </div>
      </button>

      <button
        onClick={() => setMode('upload')}
        className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-green-900/40 flex items-center justify-center shrink-0">
          <Upload size={20} className="text-green-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Upload to Frame.io</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Upload a new file directly to the linked Frame.io project
          </p>
        </div>
      </button>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────

export function RevisionsClient({
  projectId,
  includedRevisionRounds,
  revisions,
  frameioLinked,
  frameioRootFolderId,
}: {
  projectId: string
  includedRevisionRounds: number
  revisions: Revision[]
  frameioLinked: boolean
  frameioRootFolderId: string | null
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [addDialog, setAddDialog] = useState(false)
  const [isRefreshing, startRefreshTransition] = useTransition()

  if (!frameioLinked) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
            <Link2Off size={24} className="text-gray-500" />
          </div>
          <div>
            <p className="text-white font-semibold text-base mb-1">No Frame.io Project Linked</p>
            <p className="text-gray-400 text-sm">
              Link a Frame.io project to this project before managing revisions.
            </p>
          </div>
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" className="text-gray-300 border-gray-600 hover:bg-gray-700">
              Go to Project Settings
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Billing: EXT count − 1 = client revision rounds used (first EXT is initial delivery)
  const extCount = revisions.filter(r => r.category === 'EXT').length
  const usedRounds = Math.max(0, extCount - 1)
  const extraRounds = Math.max(0, usedRounds - includedRevisionRounds)

  const latestRevision = revisions.length > 0
    ? revisions.reduce((a, b) => (a.orderId > b.orderId ? a : b))
    : null

  function handleRefreshComments() {
    startRefreshTransition(async () => {
      await refreshRevisionComments(projectId)
      toast('Comment counts refreshed', 'success')
      router.refresh()
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-white font-semibold text-lg">Revisions</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            {usedRounds} of {includedRevisionRounds} included client rounds used
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-gray-300 border-gray-600 hover:bg-gray-700"
            onClick={handleRefreshComments}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh Comments
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setAddDialog(true)}
          >
            <Plus size={14} /> Add Revision
          </Button>
        </div>
      </div>

      {/* Over-limit warning banner */}
      {extraRounds > 0 && (
        <div className="flex items-center gap-3 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg text-sm text-yellow-300 mb-4">
          <AlertTriangle size={15} className="shrink-0" />
          {extraRounds} extra chargeable round{extraRounds !== 1 ? 's' : ''} beyond the {includedRevisionRounds} included.
        </div>
      )}

      {/* Empty state */}
      {revisions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Film size={36} className="text-gray-600" />
          <div>
            <p className="text-white font-medium mb-1">No revisions yet.</p>
            <p className="text-gray-400 text-sm">Add the first draft to start tracking rounds.</p>
          </div>
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setAddDialog(true)}
          >
            <Plus size={15} /> Upload First Draft
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {revisions.map((revision, index) => (
            <RevisionCard
              key={revision.id}
              revision={revision}
              previousRevision={index > 0 ? revisions[index - 1] : null}
              isLatest={latestRevision?.id === revision.id}
              projectId={projectId}
            />
          ))}
        </div>
      )}

      <Dialog open={addDialog} onClose={() => setAddDialog(false)} title="Add Revision">
        <AddRevisionDialog
          projectId={projectId}
          frameioRootFolderId={frameioRootFolderId}
          onClose={() => setAddDialog(false)}
        />
      </Dialog>

    </div>
  )
}
