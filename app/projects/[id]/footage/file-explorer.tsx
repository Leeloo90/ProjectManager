'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronRight, Folder, File, ExternalLink, Loader2, FolderPlus, Move, Trash2, Pencil } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({
  x, y, isFolder, selectionCount,
  onCreateSubfolder, onRename, onMoveTo, onDelete, onClose,
}: {
  x: number; y: number
  isFolder: boolean
  selectionCount: number
  onCreateSubfolder: () => void
  onRename: () => void
  onMoveTo: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Clamp to viewport
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    setPos({
      x: rect.right > vw ? x - rect.width : x,
      y: rect.bottom > vh ? y - rect.height : y,
    })
  }, [x, y])

  function item(label: string, icon: React.ReactNode, onClick: () => void, danger = false) {
    return (
      <button
        key={label}
        onClick={() => { onClick(); onClose() }}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left rounded transition-colors ${danger ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-200 hover:bg-gray-700'}`}
      >
        {icon}{label}
      </button>
    )
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[170px]"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={e => e.preventDefault()}
    >
      {isFolder && item('New subfolder', <FolderPlus size={14} />, onCreateSubfolder)}
      {selectionCount === 1 && item('Rename', <Pencil size={14} />, onRename)}
      {item('Move to…', <Move size={14} />, onMoveTo)}
      {item('Delete', <Trash2 size={14} />, onDelete, true)}
    </div>
  )
}

// ─── Folder Picker (for Move To dialog) ──────────────────────────────────────

function FolderPickerNode({
  folder, level, onPick, excludeIds,
}: {
  folder: DriveFile
  level: number
  onPick: (id: string, name: string) => void
  excludeIds: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchChildren() {
    setLoading(true)
    try {
      const res = await fetch(`/api/drive/files?folderId=${folder.id}`)
      const data: DriveFile[] = await res.json()
      setChildren(data.filter(f => f.mimeType === FOLDER_MIME))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) fetchChildren() }, [open])

  if (excludeIds.has(folder.id)) return null

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 rounded hover:bg-gray-700 cursor-pointer"
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        <button
          className="flex items-center gap-1 flex-1 text-left"
          onClick={() => setOpen(o => !o)}
        >
          <ChevronRight size={13} className={`transition-transform flex-shrink-0 text-gray-500 ${open ? 'rotate-90' : ''}`} />
          <Folder size={13} className="text-yellow-400 flex-shrink-0" />
          <span className="flex-1 truncate text-gray-200 text-sm">{folder.name}</span>
          {loading && <Loader2 size={12} className="animate-spin flex-shrink-0" />}
        </button>
        <button
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded flex-shrink-0 mr-1"
          onClick={() => onPick(folder.id, folder.name)}
        >
          Move here
        </button>
      </div>
      {open && children.map(c => (
        <FolderPickerNode key={c.id} folder={c} level={level + 1} onPick={onPick} excludeIds={excludeIds} />
      ))}
    </div>
  )
}

function MoveToDialog({
  files, rootFolderId, rootFolderName, onMove, onClose,
}: {
  files: DriveFile[]
  rootFolderId: string
  rootFolderName: string
  onMove: (targetId: string, targetName: string) => void
  onClose: () => void
}) {
  const [topLevel, setTopLevel] = useState<DriveFile[]>([])
  const excludeIds = new Set(files.filter(f => f.mimeType === FOLDER_MIME).map(f => f.id))

  useEffect(() => {
    fetch(`/api/drive/files?folderId=${rootFolderId}`)
      .then(r => r.json())
      .then((data: DriveFile[]) => setTopLevel(data.filter(f => f.mimeType === FOLDER_MIME)))
      .catch(() => {})
  }, [rootFolderId])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-80 max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-semibold text-sm">
            Move {files.length} item{files.length !== 1 ? 's' : ''} to…
          </h2>
          {files.length <= 3 && (
            <p className="text-gray-400 text-xs mt-0.5 truncate">{files.map(f => f.name).join(', ')}</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {/* Root folder option */}
          <div className="flex items-center gap-1 py-1 rounded hover:bg-gray-700 px-2">
            <Folder size={13} className="text-yellow-400 flex-shrink-0" />
            <span className="flex-1 truncate text-gray-200 text-sm font-medium">{rootFolderName}</span>
            <button
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded flex-shrink-0"
              onClick={() => onMove(rootFolderId, rootFolderName)}
            >
              Move here
            </button>
          </div>
          {topLevel.map(f => (
            <FolderPickerNode key={f.id} folder={f} level={0} onPick={onMove} excludeIds={excludeIds} />
          ))}
        </div>
        <div className="px-4 py-2 border-t border-gray-700 flex justify-end">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Text Input Dialog (Create Folder / Rename) ───────────────────────────────

function TextInputDialog({
  title, label, initialValue, onConfirm, onClose,
}: {
  title: string
  label: string
  initialValue?: string
  onConfirm: (value: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(initialValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-72 p-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-sm mb-3">{title}</h2>
        <label className="text-xs text-gray-400 block mb-1">{label}</label>
        <input
          ref={inputRef}
          className="w-full bg-gray-700 border border-gray-600 rounded-md text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && value.trim()) { onConfirm(value.trim()); onClose() }
            else if (e.key === 'Escape') onClose()
          }}
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1">Cancel</button>
          <button
            disabled={!value.trim()}
            onClick={() => { if (value.trim()) { onConfirm(value.trim()); onClose() } }}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  files, onConfirm, onClose,
}: {
  files: DriveFile[]
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-72 p-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-sm mb-2">
          Delete {files.length} item{files.length !== 1 ? 's' : ''}?
        </h2>
        <p className="text-gray-400 text-xs mb-3">
          Item{files.length !== 1 ? 's' : ''} will be moved to trash in Google Drive.
        </p>
        {files.length <= 5 && (
          <ul className="text-xs text-gray-300 mb-3 space-y-0.5">
            {files.map(f => <li key={f.id} className="truncate">• {f.name}</li>)}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared callbacks type ────────────────────────────────────────────────────

type NodeCallbacks = {
  selectedIds: Set<string>
  onSelect: (file: DriveFile, e: React.MouseEvent) => void
  onContextMenu: (file: DriveFile, parentId: string, e: React.MouseEvent) => void
  onDragStart: (file: DriveFile, e: React.DragEvent) => void
  onDropOnFolder: (folderId: string, folderName: string, e: React.DragEvent) => void
  onSelectFolder: (id: string, name: string) => void
  refreshKey: number
}

// ─── File Explorer Node ───────────────────────────────────────────────────────

function FileExplorerNode({
  file, parentFolderId, level, callbacks,
}: {
  file: DriveFile
  parentFolderId: string
  level: number
  callbacks: NodeCallbacks
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [children, setChildren] = useState<DriveFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const isFolder = file.mimeType === FOLDER_MIME
  const isSelected = callbacks.selectedIds.has(file.id)

  async function fetchChildren() {
    if (!isFolder) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/drive/files?folderId=${file.id}`)
      const data = await res.json()
      setChildren(data)
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }

  useEffect(() => {
    if (isOpen) fetchChildren()
  }, [isOpen, callbacks.refreshKey])

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    callbacks.onSelect(file, e)
    if (isFolder) {
      callbacks.onSelectFolder(file.id, file.name)
      if (!isOpen) setIsOpen(true)
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    callbacks.onContextMenu(file, parentFolderId, e)
  }

  function handleDragStart(e: React.DragEvent) {
    callbacks.onDragStart(file, e)
  }

  function handleDragOver(e: React.DragEvent) {
    if (!isFolder) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving this element entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (!isFolder) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    callbacks.onDropOnFolder(file.id, file.name, e)
  }

  return (
    <div className="text-sm">
      <div
        className={`flex items-center gap-2 py-1.5 rounded-md pr-2 cursor-pointer select-none transition-colors
          ${isDragOver ? 'bg-blue-800/60 ring-1 ring-blue-500' : isSelected ? 'bg-blue-700/40' : 'hover:bg-gray-700/50'}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          onClick={e => { e.stopPropagation(); if (isFolder) setIsOpen(o => !o) }}
          className="p-1 -ml-1 rounded-full hover:bg-gray-600"
        >
          {isFolder
            ? <ChevronRight size={14} className={`transition-transform min-w-4 ${isOpen ? 'rotate-90' : ''}`} />
            : <div style={{ width: '14px' }} className="min-w-4" />}
        </div>
        {isFolder
          ? <Folder size={14} className="text-yellow-400 min-w-4" />
          : <File size={14} className="text-gray-400 min-w-4" />}
        <span className="truncate flex-1 text-white">{file.name}</span>
        {isLoading && <Loader2 size={14} className="animate-spin" />}
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="ml-auto text-blue-400 hover:text-blue-300 opacity-70 hover:opacity-100"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {isOpen && (
        <div className="mt-1">
          {isLoading ? null : children.length === 0 ? (
            <div className="py-1.5 text-gray-500 text-xs" style={{ paddingLeft: `${(level + 1) * 16}px` }}>
              (empty)
            </div>
          ) : children.map(child => (
            <FileExplorerNode
              key={child.id}
              file={child}
              parentFolderId={file.id}
              level={level + 1}
              callbacks={callbacks}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root File Explorer ───────────────────────────────────────────────────────

export type RootFileExplorerProps = {
  folderId: string
  folderName: string
  selectedFolderId: string | null
  onSelectFolder: (id: string, name: string) => void
  refreshKey: number
}

export function RootFileExplorer({
  folderId, folderName, selectedFolderId, onSelectFolder, refreshKey,
}: RootFileExplorerProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(true)
  const [children, setChildren] = useState<DriveFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [internalRefresh, setInternalRefresh] = useState(0)

  // ── Multi-select ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedFiles, setSelectedFiles] = useState<Map<string, DriveFile>>(new Map())

  // ── Context menu ──────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; file: DriveFile; parentId: string
  } | null>(null)

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [createFolderState, setCreateFolderState] = useState<{ parentId: string } | null>(null)
  const [renameState, setRenameState] = useState<{ file: DriveFile } | null>(null)
  const [deleteState, setDeleteState] = useState<DriveFile[] | null>(null)
  const [moveToState, setMoveToState] = useState<DriveFile[] | null>(null)

  // ── Drag over root ────────────────────────────────────────────────────────
  const [rootDragOver, setRootDragOver] = useState(false)

  const totalRefresh = refreshKey + internalRefresh
  function bumpRefresh() { setInternalRefresh(k => k + 1) }

  async function fetchChildren() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/drive/files?folderId=${folderId}`)
      const data = await res.json()
      setChildren(data)
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }

  useEffect(() => { fetchChildren() }, [folderId, totalRefresh])

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') setContextMenu(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ── Selection ─────────────────────────────────────────────────────────────
  const handleSelect = useCallback((file: DriveFile, e: React.MouseEvent) => {
    const multi = e.shiftKey || e.ctrlKey || e.metaKey
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(file.id)) next.delete(file.id)
        else next.add(file.id)
      } else {
        next.clear()
        next.add(file.id)
      }
      return next
    })
    setSelectedFiles(prev => {
      const next = new Map(prev)
      if (multi) {
        if (next.has(file.id)) next.delete(file.id)
        else next.set(file.id, file)
      } else {
        next.clear()
        next.set(file.id, file)
      }
      return next
    })
  }, [])

  // ── Context menu ──────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((file: DriveFile, parentId: string, e: React.MouseEvent) => {
    // If right-clicked item isn't already selected, select only it
    setSelectedIds(prev => {
      if (prev.has(file.id)) return prev
      return new Set([file.id])
    })
    setSelectedFiles(prev => {
      if (prev.has(file.id)) return prev
      return new Map([[file.id, file]])
    })
    setContextMenu({ x: e.clientX, y: e.clientY, file, parentId })
  }, [])

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((file: DriveFile, e: React.DragEvent) => {
    // If dragged item isn't selected, treat it as a single-item drag
    const ids = selectedIds.has(file.id) ? [...selectedIds] : [file.id]
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', ids.join(','))
    if (!selectedIds.has(file.id)) {
      setSelectedIds(new Set([file.id]))
      setSelectedFiles(new Map([[file.id, file]]))
    }
  }, [selectedIds])

  const handleDropOnFolder = useCallback((targetFolderId: string, targetFolderName: string, e: React.DragEvent) => {
    const idsStr = e.dataTransfer.getData('text/plain')
    if (!idsStr) return
    const ids = idsStr.split(',').filter(Boolean)
    if (ids.includes(targetFolderId)) return // can't move into itself

    const filesToMove = ids.map(id => selectedFiles.get(id)).filter(Boolean) as DriveFile[]
    if (!filesToMove.length) return
    doMove(filesToMove, targetFolderId, targetFolderName)
  }, [selectedFiles])

  // ── API helpers ───────────────────────────────────────────────────────────
  async function doCreateFolder(name: string, parentId: string) {
    try {
      const res = await fetch('/api/drive/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId }),
      })
      if (!res.ok) throw new Error()
      toast(`Created folder "${name}"`, 'success')
      bumpRefresh()
    } catch {
      toast('Failed to create folder', 'error')
    }
  }

  async function doRename(fileId: string, newName: string) {
    try {
      const res = await fetch('/api/drive/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, newName }),
      })
      if (!res.ok) throw new Error()
      toast(`Renamed to "${newName}"`, 'success')
      bumpRefresh()
    } catch {
      toast('Failed to rename', 'error')
    }
  }

  async function doDelete(files: DriveFile[]) {
    try {
      const res = await fetch('/api/drive/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: files.map(f => f.id) }),
      })
      if (!res.ok) throw new Error()
      toast(`Moved ${files.length} item${files.length !== 1 ? 's' : ''} to trash`, 'success')
      setSelectedIds(new Set())
      setSelectedFiles(new Map())
      bumpRefresh()
    } catch {
      toast('Failed to delete', 'error')
    }
  }

  async function doMove(files: DriveFile[], targetFolderId: string, targetFolderName: string) {
    try {
      const res = await fetch('/api/drive/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: files.map(f => f.id), newParentId: targetFolderId }),
      })
      if (!res.ok) throw new Error()
      toast(`Moved ${files.length} item${files.length !== 1 ? 's' : ''} to "${targetFolderName}"`, 'success')
      setSelectedIds(new Set())
      setSelectedFiles(new Map())
      bumpRefresh()
    } catch {
      toast('Failed to move', 'error')
    }
  }

  // Items to act on from context menu: whole selection if >1, else just the right-clicked file
  function getContextFiles(): DriveFile[] {
    if (!contextMenu) return []
    if (selectedIds.size > 1) return [...selectedFiles.values()]
    return [contextMenu.file]
  }

  const callbacks: NodeCallbacks = {
    selectedIds,
    onSelect: handleSelect,
    onContextMenu: handleContextMenu,
    onDragStart: handleDragStart,
    onDropOnFolder: handleDropOnFolder,
    onSelectFolder,
    refreshKey: totalRefresh,
  }

  const isRootSelected = selectedFolderId === folderId

  return (
    <div
      className="text-sm"
      onClick={() => { setContextMenu(null); setSelectedIds(new Set()); setSelectedFiles(new Map()) }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* ── Root row ─────────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-2 py-1.5 rounded-md pr-2 cursor-pointer select-none transition-colors
          ${rootDragOver ? 'bg-blue-800/60 ring-1 ring-blue-500' : isRootSelected ? 'bg-blue-900/50' : 'hover:bg-gray-700/50'}`}
        onClick={e => { e.stopPropagation(); onSelectFolder(folderId, folderName) }}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setRootDragOver(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRootDragOver(false) }}
        onDrop={e => {
          e.preventDefault(); e.stopPropagation(); setRootDragOver(false)
          handleDropOnFolder(folderId, folderName, e)
        }}
      >
        <div
          onClick={e => { e.stopPropagation(); setIsOpen(o => !o) }}
          className="p-1 -ml-1 rounded-full hover:bg-gray-600"
        >
          <ChevronRight size={14} className={`transition-transform min-w-4 ${isOpen ? 'rotate-90' : ''}`} />
        </div>
        <Folder size={14} className="text-yellow-400 min-w-4" />
        <span className="font-medium text-white">{folderName}</span>
        {isLoading && <Loader2 size={14} className="animate-spin ml-2" />}
        <a
          href={`https://drive.google.com/drive/folders/${folderId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="ml-auto text-blue-400 hover:text-blue-300 opacity-70 hover:opacity-100"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* ── Children ─────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="mt-1">
          {children.length === 0 && !isLoading ? (
            <div className="py-1.5 text-gray-500 text-xs" style={{ paddingLeft: '16px' }}>(empty)</div>
          ) : children.map(child => (
            <FileExplorerNode
              key={child.id}
              file={child}
              parentFolderId={folderId}
              level={1}
              callbacks={callbacks}
            />
          ))}
        </div>
      )}

      {/* ── Context Menu ─────────────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isFolder={contextMenu.file.mimeType === FOLDER_MIME}
          selectionCount={selectedIds.size}
          onCreateSubfolder={() => setCreateFolderState({ parentId: contextMenu.file.id })}
          onRename={() => setRenameState({ file: contextMenu.file })}
          onMoveTo={() => setMoveToState(getContextFiles())}
          onDelete={() => setDeleteState(getContextFiles())}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      {createFolderState && (
        <TextInputDialog
          title="New Subfolder"
          label="Folder name"
          onConfirm={name => doCreateFolder(name, createFolderState.parentId)}
          onClose={() => setCreateFolderState(null)}
        />
      )}
      {renameState && (
        <TextInputDialog
          title="Rename"
          label="New name"
          initialValue={renameState.file.name}
          onConfirm={name => doRename(renameState.file.id, name)}
          onClose={() => setRenameState(null)}
        />
      )}
      {deleteState && (
        <DeleteConfirmDialog
          files={deleteState}
          onConfirm={() => doDelete(deleteState)}
          onClose={() => setDeleteState(null)}
        />
      )}
      {moveToState && (
        <MoveToDialog
          files={moveToState}
          rootFolderId={folderId}
          rootFolderName={folderName}
          onMove={(targetId, targetName) => {
            doMove(moveToState, targetId, targetName)
            setMoveToState(null)
          }}
          onClose={() => setMoveToState(null)}
        />
      )}
    </div>
  )
}
