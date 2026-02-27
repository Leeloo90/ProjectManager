'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play, Pause, Volume2, VolumeX, Maximize2, MessageSquare,
  X, Loader2, Send, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

type FolderItem = {
  id: string
  name: string
  type: 'file' | 'folder' | 'version_stack'
  thumb_url: string | null
  duration: number | null
  comment_count: number
  media_type: string | null
}

type CommentOwner = { name: string; email: string | null; avatar_url: string | null }
type Comment = {
  id: string
  text: string
  timestamp: string | null
  owner: CommentOwner
  replies: Comment[]
  created_at: string | null
}

// ─── Timecode Helpers ─────────────────────────────────────────────────────────

function timecodeToSeconds(tc: string | null | undefined): number {
  if (!tc || typeof tc !== 'string') return 0
  const parts = tc.split(':')
  if (parts.length !== 4) return 0
  const [h, m, s, f] = parts.map(Number)
  return h * 3600 + m * 60 + s + f / 24
}

function secondsToTimecode(secs: number, fps = 24): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  const f = Math.floor((secs % 1) * fps)
  return [h, m, s, f].map(n => n.toString().padStart(2, '0')).join(':')
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getCommenterName(owner: CommentOwner): string {
  if (owner.name) return owner.name
  if (owner.email) return owner.email
  return 'Guest'
}

function getInitials(owner: CommentOwner): string {
  const name = getCommenterName(owner)
  if (name === 'Guest') return 'G'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
}

function Initials({ owner, avatarUrl }: { owner: CommentOwner; avatarUrl: string | null }) {
  const isGuest = getCommenterName(owner) === 'Guest'
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={getCommenterName(owner)} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
    )
  }
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isGuest ? 'bg-gray-600' : 'bg-indigo-600'}`}>
      {getInitials(owner)}
    </div>
  )
}

// ─── Comment Card ─────────────────────────────────────────────────────────────

function CommentCard({
  comment,
  onSeek,
  onReply,
}: {
  comment: Comment
  onSeek: (secs: number) => void
  onReply: (commentId: string, text: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localReplies, setLocalReplies] = useState<Comment[]>(comment.replies)

  async function handleSubmitReply() {
    if (!replyText.trim()) return
    setSubmitting(true)
    await onReply(comment.id, replyText.trim())
    setLocalReplies(prev => [...prev, {
      id: Date.now().toString(),
      text: replyText.trim(),
      timestamp: null,
      owner: { name: 'You', email: null, avatar_url: null },
      replies: [],
      created_at: new Date().toISOString(),
    }])
    setReplyText('')
    setReplying(false)
    setSubmitting(false)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Initials owner={comment.owner} avatarUrl={comment.owner.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-medium truncate ${getCommenterName(comment.owner) === 'Guest' ? 'text-gray-400 italic' : 'text-white'}`}>
              {getCommenterName(comment.owner)}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {comment.timestamp && (
                <button
                  onClick={() => onSeek(timecodeToSeconds(comment.timestamp))}
                  className="text-xs bg-orange-500 hover:bg-orange-400 text-white px-2 py-0.5 rounded-full font-mono transition-colors"
                >
                  {formatTime(timecodeToSeconds(comment.timestamp))}
                </button>
              )}
              <span className="text-xs text-gray-500">{timeAgo(comment.created_at)}</span>
            </div>
          </div>
          <p className="text-sm text-gray-300 mt-1 break-words">{comment.text}</p>
        </div>
      </div>

      {/* Replies toggle */}
      {localReplies.length > 0 && (
        <div className="ml-10">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {localReplies.length} {localReplies.length === 1 ? 'reply' : 'replies'}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {localReplies.map(r => (
                <div key={r.id} className="flex items-start gap-2">
                  <Initials owner={r.owner} avatarUrl={r.owner.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${getCommenterName(r.owner) === 'Guest' ? 'text-gray-400 italic' : 'text-white'}`}>
                        {getCommenterName(r.owner)}
                      </span>
                      <span className="text-xs text-gray-500">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-300 break-words">{r.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reply action */}
      <div className="ml-10">
        {replying ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1.5 resize-none border border-gray-600 focus:border-gray-400 outline-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitReply}
                disabled={submitting || !replyText.trim()}
                className="text-xs bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white px-3 py-1 rounded transition-colors flex items-center gap-1"
              >
                {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                Reply
              </button>
              <button
                onClick={() => { setReplying(false); setReplyText('') }}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setReplying(true)}
            className="text-xs text-gray-500 hover:text-orange-400 transition-colors"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Asset Viewer ─────────────────────────────────────────────────────────────

export function FrameioAssetViewer({
  file,
  accountId,
  onClose,
}: {
  file: FolderItem
  accountId: string
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [fileLink, setFileLink] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [commentMode, setCommentMode] = useState(false)
  const [commentInput, setCommentInput] = useState({ visible: false, timecode: '', text: '' })
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // Fetch playback URL
  const fetchPlaybackUrl = useCallback(async () => {
    setLoadingUrl(true)
    try {
      const params = new URLSearchParams({ fileId: file.id })
      if (accountId) params.set('accountId', accountId)
      const res = await fetch(`/api/frameio/file?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setPlaybackUrl(data.playback_url ?? null)
      setFileLink(data.link ?? data.view_url ?? null)
    } finally {
      setLoadingUrl(false)
    }
  }, [file.id, accountId])

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoadingComments(true)
    try {
      const params = new URLSearchParams({ fileId: file.id })
      if (accountId) params.set('accountId', accountId)
      const res = await fetch(`/api/frameio/comments?${params}`)
      if (!res.ok) return
      const data: Comment[] = await res.json()
      // Sort: timestamped comments first (ascending), then general comments
      data.sort((a, b) => {
        if (a.timestamp && b.timestamp) return timecodeToSeconds(a.timestamp) - timecodeToSeconds(b.timestamp)
        if (a.timestamp) return -1
        if (b.timestamp) return 1
        return 0
      })
      setComments(data)
    } finally {
      setLoadingComments(false)
    }
  }, [file.id, accountId])

  useEffect(() => {
    fetchPlaybackUrl()
    fetchComments()
  }, [fetchPlaybackUrl, fetchComments])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      const v = videoRef.current
      if (!v) return
      if (e.code === 'Space') { e.preventDefault(); v.paused ? v.play() : v.pause() }
      if (e.code === 'ArrowLeft') { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5) }
      if (e.code === 'ArrowRight') { e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 5) }
      if (e.key === 'j' || e.key === 'J') v.currentTime = Math.max(0, v.currentTime - 10)
      if (e.key === 'l' || e.key === 'L') v.currentTime = Math.min(v.duration, v.currentTime + 10)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handlePlayPause() {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play() : v.pause()
  }

  function handleSeek(secs: number) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = secs
    if (v.paused) v.play()
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = progressRef.current
    if (!el || !duration) return
    const rect = el.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    handleSeek(ratio * duration)
  }

  function handleVideoClick() {
    if (!commentMode) return
    const v = videoRef.current
    if (!v) return
    v.pause()
    setCommentInput({ visible: true, timecode: secondsToTimecode(v.currentTime), text: '' })
  }

  async function handlePostTimedComment() {
    if (!commentInput.text.trim()) return
    setPostingComment(true)
    const res = await fetch('/api/frameio/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file.id, text: commentInput.text.trim(), timestamp: commentInput.timecode, accountId }),
    })
    if (res.ok) {
      const newC: Comment = await res.json()
      setComments(prev => {
        const updated = [...prev, newC]
        updated.sort((a, b) => {
          if (a.timestamp && b.timestamp) return timecodeToSeconds(a.timestamp) - timecodeToSeconds(b.timestamp)
          if (a.timestamp) return -1
          if (b.timestamp) return 1
          return 0
        })
        return updated
      })
    }
    setCommentInput({ visible: false, timecode: '', text: '' })
    setPostingComment(false)
    videoRef.current?.play()
  }

  async function handlePostGeneralComment() {
    if (!newComment.trim()) return
    setPostingComment(true)
    const res = await fetch('/api/frameio/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file.id, text: newComment.trim(), accountId }),
    })
    if (res.ok) {
      const newC: Comment = await res.json()
      setComments(prev => [...prev, newC])
    }
    setNewComment('')
    setPostingComment(false)
  }

  async function handleReply(commentId: string, text: string) {
    await fetch('/api/frameio/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, text, accountId }),
    })
  }

  // Comment marker positions
  const commentMarkers = comments
    .filter(c => !!c.timestamp)
    .map(c => ({ id: c.id, pct: duration > 0 ? (timecodeToSeconds(c.timestamp) / duration) * 100 : 0 }))

  const isVideo = (file.media_type ?? '').startsWith('video') || file.type === 'version_stack'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Asset name bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
        <span className="text-sm text-white font-medium truncate">{file.name}</span>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          {fileLink && (
            <a
              href={fileLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              View on Frame.io ↗
            </a>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Video Panel (70%) ─────────────────────────────────────────── */}
        <div className="flex flex-col" style={{ width: '70%' }}>
          {/* Video area */}
          <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
            {loadingUrl ? (
              <Loader2 size={32} className="animate-spin text-gray-500" />
            ) : !playbackUrl || !isVideo ? (
              <div className="text-gray-500 text-sm text-center p-4">
                {!isVideo ? 'Preview not available for this file type.' : 'No playback URL available.'}
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={playbackUrl}
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-contain"
                  onClick={handleVideoClick}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                  onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
                  onError={() => { fetchPlaybackUrl() }}
                  style={{ cursor: commentMode ? 'crosshair' : 'default' }}
                />

                {/* Comment mode overlay hint */}
                {commentMode && !commentInput.visible && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-orange-500 bg-opacity-90 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
                    Click video to add a timed comment
                  </div>
                )}

                {/* Inline comment input */}
                {commentInput.visible && (
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-lg p-3 w-80 shadow-xl">
                    <div className="text-xs text-orange-400 font-mono mb-2">{commentInput.timecode}</div>
                    <textarea
                      autoFocus
                      value={commentInput.text}
                      onChange={e => setCommentInput(prev => ({ ...prev, text: e.target.value }))}
                      placeholder="Add a comment at this timecode…"
                      className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1.5 resize-none border border-gray-700 focus:border-gray-500 outline-none"
                      rows={3}
                      onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handlePostTimedComment() }}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handlePostTimedComment}
                        disabled={postingComment || !commentInput.text.trim()}
                        className="text-xs bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white px-3 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        {postingComment ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        Post
                      </button>
                      <button
                        onClick={() => { setCommentInput({ visible: false, timecode: '', text: '' }); videoRef.current?.play() }}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls bar */}
          {isVideo && playbackUrl && (
            <div className="bg-gray-950 border-t border-gray-800 px-3 py-2 space-y-1.5">
              {/* Progress bar */}
              <div
                ref={progressRef}
                onClick={handleProgressClick}
                className="relative w-full h-2 bg-gray-700 rounded-full cursor-pointer group"
              >
                {/* Played */}
                <div
                  className="absolute left-0 top-0 h-full bg-orange-500 rounded-full pointer-events-none"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* Comment markers */}
                {commentMarkers.map(m => (
                  <div
                    key={m.id}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-300 pointer-events-none"
                    style={{ left: `${m.pct}%` }}
                  />
                ))}
              </div>

              {/* Buttons row */}
              <div className="flex items-center gap-3">
                <button onClick={handlePlayPause} className="text-white hover:text-orange-400 transition-colors">
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="flex items-center gap-1.5 ml-auto">
                  {/* Volume */}
                  <button
                    onClick={() => { setMuted(v => !v); if (videoRef.current) videoRef.current.muted = !muted }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={muted ? 0 : volume}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setVolume(v)
                      if (videoRef.current) videoRef.current.volume = v
                    }}
                    className="w-16 accent-orange-500"
                  />

                  {/* Comment mode toggle */}
                  <button
                    onClick={() => setCommentMode(v => !v)}
                    title="Comment mode — click video to add timed comment"
                    className={`ml-2 transition-colors ${commentMode ? 'text-orange-400' : 'text-gray-400 hover:text-white'}`}
                  >
                    <MessageSquare size={16} />
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={() => videoRef.current?.requestFullscreen()}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Comments Panel (30%) ──────────────────────────────────────── */}
        <div className="flex flex-col border-l border-gray-800 bg-gray-900" style={{ width: '30%' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare size={15} />
              Comments ({comments.length})
            </h3>
          </div>

          {/* Comment list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loadingComments ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading…
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No comments yet.</p>
            ) : (
              comments.map(c => (
                <CommentCard key={c.id} comment={c} onSeek={handleSeek} onReply={handleReply} />
              ))
            )}
          </div>

          {/* Add comment */}
          <div className="p-3 border-t border-gray-800 flex-shrink-0 space-y-2">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 resize-none border border-gray-700 focus:border-gray-500 outline-none"
              rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handlePostGeneralComment() }}
            />
            <button
              onClick={handlePostGeneralComment}
              disabled={postingComment || !newComment.trim()}
              className="w-full text-sm bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white py-1.5 rounded flex items-center justify-center gap-2 transition-colors"
            >
              {postingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Post Comment
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
