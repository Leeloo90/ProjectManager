// app/api/drive/files/route.ts
import { NextResponse } from 'next/server'
import { getDriveClient } from '@/lib/google-drive'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folderId')

  if (!folderId) {
    return NextResponse.json({ error: 'folderId is required' }, { status: 400 })
  }

  try {
    const drive = await getDriveClient()
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, iconLink)',
      orderBy: 'folder,name',
      spaces: 'drive',
    })

    return NextResponse.json(res.data.files)
  } catch (error: any) {
    console.error('Error fetching files from Google Drive:', error)
    return NextResponse.json({ error: 'Failed to fetch files from Google Drive' }, { status: 500 })
  }
}
