import { NextRequest, NextResponse } from 'next/server'
import { getDriveClient } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const { fileIds } = await request.json()
    if (!fileIds?.length) {
      return NextResponse.json({ error: 'fileIds are required' }, { status: 400 })
    }

    const drive = await getDriveClient()

    for (const fileId of fileIds) {
      // Trash rather than permanently delete — safer, matches Drive UI behaviour
      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
