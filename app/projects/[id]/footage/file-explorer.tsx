'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, Folder, File, ExternalLink, Loader2 } from 'lucide-react'

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
}

type FileExplorerNodeProps = {
  file: DriveFile
  level: number
  selectedFolderId: string | null
  onSelectFolder: (id: string, name: string) => void
  refreshKey: number
}

function FileExplorerNode({ file, level, selectedFolderId, onSelectFolder, refreshKey }: FileExplorerNodeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [children, setChildren] = useState<DriveFile[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const isFolder = file.mimeType === FOLDER_MIME_TYPE;

  async function fetchChildren() {
    if (!isFolder) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/drive/files?folderId=${file.id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setChildren(data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchChildren()
    }
  }, [isOpen, refreshKey])

  function handleToggle() {
    if (!isFolder) return;
    setIsOpen(!isOpen)
  }
  
  function handleSelect() {
    if (!isFolder) return;
    onSelectFolder(file.id, file.name);
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const isSelected = selectedFolderId === file.id;

  return (
    <div className="text-sm">
      <div 
        className={`flex items-center gap-2 py-1.5 rounded-md pr-2 cursor-pointer ${isSelected ? 'bg-blue-900/50' : 'hover:bg-gray-700/50'}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleSelect}
      >
        <div onClick={(e) => { e.stopPropagation(); handleToggle(); }} className="p-1 -ml-1 rounded-full hover:bg-gray-600">
          {isFolder ? <ChevronRight size={14} className={`transition-transform min-w-4 ${isOpen ? 'rotate-90' : ''}`} /> : <div style={{width: '14px'}} className="min-w-4"></div>}
        </div>
        {isFolder ? <Folder size={14} className="text-yellow-400 min-w-4" /> : <File size={14} className="text-gray-400 min-w-4" />}
        <span className="truncate flex-1 text-white">{file.name}</span>
        {isLoading && <Loader2 size={14} className="animate-spin" />}
        <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="ml-auto text-blue-400 hover:text-blue-300 opacity-70 hover:opacity-100">
            <ExternalLink size={13} />
        </a>
      </div>
      {isOpen && (
        <div className="mt-1">
          {children.map(child => (
            <FileExplorerNode 
              key={child.id} 
              file={child} 
              level={level + 1} 
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              refreshKey={refreshKey}
            />
          ))}
           {children.length === 0 && !isLoading && (
             <div 
              className="flex items-center gap-2 py-1.5 rounded-md text-gray-500"
              style={{ paddingLeft: `${(level + 1) * 16}px` }}
            >
              (empty)
            </div>
           )}
        </div>
      )}
    </div>
  )
}

type RootFileExplorerProps = {
  folderId: string, 
  folderName: string,
  selectedFolderId: string | null
  onSelectFolder: (id: string, name: string) => void
  refreshKey: number
}

export function RootFileExplorer({ folderId, folderName, selectedFolderId, onSelectFolder, refreshKey }: RootFileExplorerProps) {
    const [isOpen, setIsOpen] = useState(true)
    const [children, setChildren] = useState<DriveFile[]>([])
    const [isLoading, setIsLoading] = useState(false)

    async function fetchChildren() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/drive/files?folderId=${folderId}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setChildren(data)
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    useEffect(() => {
        fetchChildren()
    }, [folderId, refreshKey])

    function handleSelect() {
      onSelectFolder(folderId, folderName);
      if (!isOpen) {
        setIsOpen(true)
      }
    }

    function handleToggle() {
      setIsOpen(!isOpen);
    }
    
    const isSelected = selectedFolderId === folderId;

    return (
        <div className="text-sm">
            <div 
              className={`flex items-center gap-2 py-1.5 rounded-md pr-2 cursor-pointer ${isSelected ? 'bg-blue-900/50' : 'hover:bg-gray-700/50'}`}
              onClick={handleSelect}
            >
                <div onClick={(e) => { e.stopPropagation(); handleToggle(); }} className="p-1 -ml-1 rounded-full hover:bg-gray-600">
                  <ChevronRight size={14} className={`transition-transform min-w-4 ${isOpen ? 'rotate-90' : ''}`} />
                </div>
                <Folder size={14} className="text-yellow-400 min-w-4" />
                <span className="font-medium text-white">{folderName}</span>
                {isLoading && <Loader2 size={14} className="animate-spin ml-2" />}
                <a href={`https://drive.google.com/drive/folders/${folderId}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="ml-auto text-blue-400 hover:text-blue-300 opacity-70 hover:opacity-100">
                  <ExternalLink size={13} />
                </a>
            </div>
            {isOpen && (
                 <div className="mt-1">
                 {children.map(child => (
                   <FileExplorerNode 
                      key={child.id} 
                      file={child} 
                      level={1} 
                      selectedFolderId={selectedFolderId}
                      onSelectFolder={onSelectFolder}
                      refreshKey={refreshKey}
                    />
                 ))}
                  {children.length === 0 && !isLoading && (
                    <div 
                      className="flex items-center gap-2 py-1.5 rounded-md text-gray-500"
                      style={{ paddingLeft: `${1 * 16}px` }}
                    >
                      (empty)
                    </div>
                  )}
               </div>
            )}
        </div>
    )
}
