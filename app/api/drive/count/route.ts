import { NextResponse } from 'next/server'
import { getDriveClient } from '@/lib/google-drive'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

// BFS across all subfolders, parallelising each level for speed
async function countFilesRecursive(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  rootFolderId: string,
): Promise<number> {
  let count = 0
  let queue = [rootFolderId]

  while (queue.length > 0) {
    const results = await Promise.all(
      queue.map(folderId =>
        drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'files(id, mimeType, name)',
          spaces: 'drive',
        })
      )
    )

    const nextQueue: string[] = []
    for (const res of results) {
      for (const file of res.data.files ?? []) {
        if (file.mimeType === FOLDER_MIME) {
          nextQueue.push(file.id!)
        } else if (file.name?.includes('.')) {
          // Only count files with an extension
          count++
        }
      }
    }
    queue = nextQueue
  }

  return count
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')

  if (!folderId) {
    return NextResponse.json({ error: 'folderId is required' }, { status: 400 })
  }

  try {
    const drive = await getDriveClient()
    const count = await countFilesRecursive(drive, folderId)
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error counting files:', error)
    return NextResponse.json({ error: 'Failed to count files' }, { status: 500 })
  }
}
