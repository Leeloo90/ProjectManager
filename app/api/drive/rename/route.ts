import { NextRequest, NextResponse } from 'next/server'
import { getDriveClient } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const { fileId, newName } = await request.json()
    if (!fileId || !newName) {
      return NextResponse.json({ error: 'fileId and newName are required' }, { status: 400 })
    }

    const drive = await getDriveClient()
    await drive.files.update({
      fileId,
      requestBody: { name: newName },
      fields: 'id, name',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
