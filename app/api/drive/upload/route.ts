import { NextRequest, NextResponse } from 'next/server'
import { getDriveClient } from '@/lib/google-drive'
import { Readable } from 'stream'

// Finds a non-conflicting name by appending _v2, _v3, etc.
async function findFreeName(drive: Awaited<ReturnType<typeof getDriveClient>>, folderId: string, baseName: string): Promise<string> {
  const ext = baseName.includes('.') ? baseName.slice(baseName.lastIndexOf('.')) : ''
  const nameWithoutExt = ext ? baseName.slice(0, baseName.lastIndexOf('.')) : baseName

  let candidate = baseName
  let attempt = 2
  while (true) {
    const q = `name = '${candidate.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`
    const res = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive' })
    if (!res.data.files || res.data.files.length === 0) return candidate
    candidate = `${nameWithoutExt}_v${attempt}${ext}`
    attempt++
    if (attempt > 100) return `${nameWithoutExt}_${Date.now()}${ext}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null
    const filename = formData.get('filename') as string | null
    const conflictResolution = formData.get('conflictResolution') as 'overwrite' | 'rename' | 'skip' | null

    if (!file || !folderId || !filename) {
      return NextResponse.json({ error: 'file, folderId, and filename are required' }, { status: 400 })
    }

    const drive = await getDriveClient()

    // Check for existing file with same name
    const q = `name = '${filename.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`
    const existing = await drive.files.list({ q, fields: 'files(id, name)', spaces: 'drive' })
    const existingFile = existing.data.files?.[0]

    if (existingFile && !conflictResolution) {
      // Report conflict — client must re-submit with resolution
      return NextResponse.json({
        conflict: true,
        existingFileId: existingFile.id,
        existingFileName: existingFile.name,
      })
    }

    if (existingFile && conflictResolution === 'skip') {
      return NextResponse.json({ success: true, skipped: true })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const stream = Readable.from(buffer)

    if (existingFile && conflictResolution === 'overwrite') {
      // Update the existing file's content
      const updated = await drive.files.update({
        fileId: existingFile.id!,
        media: {
          mimeType: file.type || 'application/octet-stream',
          body: stream,
        },
        fields: 'id, name, webViewLink',
      })
      return NextResponse.json({
        success: true,
        fileId: updated.data.id,
        fileName: updated.data.name,
        fileUrl: updated.data.webViewLink,
      })
    }

    // No conflict, or resolution = 'rename' — determine target name
    let targetName = filename
    if (existingFile && conflictResolution === 'rename') {
      targetName = await findFreeName(drive, folderId, filename)
    }

    const created = await drive.files.create({
      requestBody: {
        name: targetName,
        parents: [folderId],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: stream,
      },
      fields: 'id, name, webViewLink',
    })

    return NextResponse.json({
      success: true,
      fileId: created.data.id,
      fileName: created.data.name,
      fileUrl: created.data.webViewLink,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('not connected') ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
