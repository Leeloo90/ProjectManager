import { NextRequest, NextResponse } from 'next/server'
import { getDriveClient, findOrCreateFolder } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const { name, parentId } = await request.json()

    if (!name || !parentId) {
      return NextResponse.json({ error: 'name and parentId are required' }, { status: 400 })
    }

    const drive = await getDriveClient()
    const folderId = await findOrCreateFolder(drive, name, parentId)

    return NextResponse.json({ folderId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
