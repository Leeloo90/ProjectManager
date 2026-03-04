import { NextRequest, NextResponse } from 'next/server'
import { getDriveClient } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const { fileIds, newParentId } = await request.json()
    if (!fileIds?.length || !newParentId) {
      return NextResponse.json({ error: 'fileIds and newParentId are required' }, { status: 400 })
    }

    const drive = await getDriveClient()

    for (const fileId of fileIds) {
      // Fetch current parents so we can remove them
      const meta = await drive.files.get({ fileId, fields: 'parents' })
      const oldParents = (meta.data.parents ?? []).join(',')

      await drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: oldParents || undefined,
        fields: 'id, parents',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
